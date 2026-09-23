// Cliente HTTP genérico del backoffice (patrón de uis/talent-pipeline-tracker,
// adaptado). No sabe nada de incidentes: transporta la petición, aplica el
// timeout y traduce los fallos de transporte a errores tipados. Decidir qué
// significa cada status es tarea de los servicios (`services/*.service.ts`).
//
// Privacidad: no registra nada, no guarda cuerpos para diagnóstico y ningún
// error de este módulo lleva texto de la respuesta ni la excepción original
// (el SyntaxError de `JSON.parse` incluye fragmentos del cuerpo recibido).
//
// El JSON recibido solo se entrega, sin inspeccionarlo, a la función `parse`
// que indique el servicio (un normalizador de `services/normalizers.ts`, única
// frontera que valida datos de red).

/**
 * Cualquier valor que puede producir `JSON.parse` sin reviver: exactamente lo
 * que devuelve `Response.json()`. Tipo preciso, pero sin garantías de forma:
 * quien lo recibe debe validarlo (los normalizadores lo hacen).
 */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface ApiClientDependencies {
  /** Transporte; por defecto el `fetch` global. Inyectable en tests. */
  fetch?: FetchLike;
  /** Base URL; por defecto `NEXT_PUBLIC_API_URL`. Se lee en cada petición (validación perezosa). */
  getBaseUrl?: () => string | undefined;
}

export interface RequestOptions {
  timeoutMs: number;
  /** Cancelación desde fuera (p. ej. desmontaje de la vista). */
  signal?: AbortSignal;
}

/** Respuesta HTTP mientras se procesa: el timeout sigue activo al leer el cuerpo. */
export interface ApiResponse {
  readonly status: number;
  header(name: string): string | null;
  /** Lee el cuerpo como JSON y lo pasa a `parse`. Lanza `ApiUnexpectedResponseError` si no es JSON. */
  json<T>(parse: (body: JsonValue) => T): Promise<T>;
  blob(): Promise<Blob>;
}

export type ResponseHandler<T> = (response: ApiResponse) => Promise<T>;

export interface ApiClient {
  get<T>(path: string, options: RequestOptions, handle: ResponseHandler<T>): Promise<T>;
  postForm<T>(path: string, form: FormData, options: RequestOptions, handle: ResponseHandler<T>): Promise<T>;
}

// ---------------------------------------------------------------------------
// Errores de transporte. Mensajes fijos: nunca incluyen datos recibidos.
// ---------------------------------------------------------------------------

export class ApiClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/** `NEXT_PUBLIC_API_URL` ausente o vacía. */
export class ApiConfigError extends ApiClientError {
  constructor() {
    super('API base URL is not configured (NEXT_PUBLIC_API_URL)');
    this.name = 'ApiConfigError';
  }
}

/** No se pudo conectar (API caída, CORS, DNS…). */
export class ApiNetworkError extends ApiClientError {
  constructor() {
    super('Could not reach the API');
    this.name = 'ApiNetworkError';
  }
}

/** Se agotó el timeout de la petición (incluida la lectura del cuerpo). */
export class ApiTimeoutError extends ApiClientError {
  constructor() {
    super('The API request timed out');
    this.name = 'ApiTimeoutError';
  }
}

/** Cancelada por quien llamó (`options.signal`). No es un fallo que mostrar al usuario. */
export class ApiAbortError extends ApiClientError {
  constructor() {
    super('The API request was aborted');
    this.name = 'ApiAbortError';
  }
}

/** El cuerpo no es JSON cuando debería serlo. No incluye el cuerpo. */
export class ApiUnexpectedResponseError extends ApiClientError {
  constructor() {
    super('The API returned a response that is not valid JSON');
    this.name = 'ApiUnexpectedResponseError';
  }
}

// ---------------------------------------------------------------------------
// Implementación
// ---------------------------------------------------------------------------

function defaultBaseUrl(): string | undefined {
  // Acceso literal: Next.js solo sustituye `process.env.NEXT_PUBLIC_*` escrito así.
  return process.env.NEXT_PUBLIC_API_URL;
}

function isAbortLike(error: Error): boolean {
  // Por nombre, no por clase: el objeto de un fetch abortado varía entre entornos.
  return error.name === 'AbortError';
}

function isJsonContentType(value: string | null): boolean {
  if (value === null) return false;
  const mediaType = value.split(';')[0]?.trim().toLowerCase() ?? '';
  return mediaType === 'application/json' || mediaType.endsWith('+json');
}

function wrapResponse(raw: Response): ApiResponse {
  return {
    status: raw.status,
    header: (name) => raw.headers.get(name),
    async json(parse) {
      if (!isJsonContentType(raw.headers.get('content-type'))) {
        throw new ApiUnexpectedResponseError();
      }
      // `Response.json()` es JSON.parse sin reviver: su resultado es siempre un JsonValue.
      let body: JsonValue;
      try {
        body = await raw.json();
      } catch (error) {
        // Un abort durante la lectura lo traduce `send` (timeout o cancelación).
        if (error instanceof Error && isAbortLike(error)) throw error;
        // Sin `cause`: el SyntaxError contiene fragmentos del cuerpo.
        throw new ApiUnexpectedResponseError();
      }
      return parse(body);
    },
    blob: () => raw.blob(),
  };
}

export function createApiClient(dependencies: ApiClientDependencies = {}): ApiClient {
  const transport: FetchLike = dependencies.fetch ?? ((input, init) => fetch(input, init));
  const getBaseUrl = dependencies.getBaseUrl ?? defaultBaseUrl;

  async function send<T>(path: string, init: RequestInit, options: RequestOptions, handle: ResponseHandler<T>): Promise<T> {
    const baseUrl = getBaseUrl()?.trim();
    if (!baseUrl) throw new ApiConfigError();
    const url = `${baseUrl.replace(/\/+$/, '')}${path}`;
    if (options.signal?.aborted) throw new ApiAbortError();

    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeoutMs);
    const onCallerAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onCallerAbort);

    try {
      let raw: Response;
      try {
        // Nunca se envían credenciales: la API no las acepta (CORS sin credentials).
        raw = await transport(url, { ...init, signal: controller.signal });
      } catch (error) {
        if (timedOut) throw new ApiTimeoutError();
        if (controller.signal.aborted) throw new ApiAbortError();
        if (error instanceof Error && isAbortLike(error)) throw new ApiAbortError();
        throw new ApiNetworkError();
      }
      try {
        return await handle(wrapResponse(raw));
      } catch (error) {
        // Solo se traducen los aborts; los errores del handler (normalizador,
        // servicio) se propagan tal cual.
        if (error instanceof Error && isAbortLike(error)) {
          throw timedOut ? new ApiTimeoutError() : new ApiAbortError();
        }
        throw error;
      }
    } finally {
      clearTimeout(timeoutId);
      options.signal?.removeEventListener('abort', onCallerAbort);
    }
  }

  return {
    get: (path, options, handle) => send(path, { method: 'GET' }, options, handle),
    // Sin cabecera Content-Type: el navegador la genera con el boundary del multipart.
    postForm: (path, form, options, handle) => send(path, { method: 'POST', body: form }, options, handle),
  };
}

/** Cliente por defecto: `fetch` global y `NEXT_PUBLIC_API_URL`. */
export const apiClient: ApiClient = createApiClient();
