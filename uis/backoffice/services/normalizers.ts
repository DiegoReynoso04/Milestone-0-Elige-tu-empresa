// Normalizadores: ÚNICA frontera del backoffice donde se acepta `unknown`
// procedente de la red (CLAUDE.md, "Frontera de confianza").
//
// - Validan la FORMA del contrato de services/api/SPECS.md (tipos y número
//   de entradas), no las reglas de negocio del CSV: eso es del backend.
// - Construyen objetos nuevos campo a campo (whitelist). Nunca se hace spread
//   del objeto recibido, así que ninguna propiedad desconocida (p. ej. un
//   `customer_email` que la API enviase por error) llega al estado de la UI.
// - Los errores solo citan la ruta del campo y el tipo esperado/recibido,
//   nunca valores recibidos: no pueden contener PII.
//
// Este módulo no tiene imports en tiempo de ejecución (solo `import type`,
// que se borra al ejecutar), para poder probarlo con `node --test`.

import type {
  AnalysisResult,
  ApiErrorBody,
  DistributionItem,
  ExportInfo,
  RuleBreakdownItem,
  SatisfactionDistributionItem,
  SatisfactionResult,
  Totals,
} from '@/types/incidents';

// Estructura fija del contrato (SPECS.md §3.1): siempre las 7 reglas, las 5
// categorías, los 3 estados y las puntuaciones 1–5, aunque valgan 0.
const RULE_COUNT = 7;
const CATEGORY_COUNT = 5;
const STATUS_COUNT = 3;
const SCORE_COUNT = 5;

/** La respuesta no tiene la forma del contrato. El mensaje no incluye valores recibidos. */
export class UnexpectedResponseError extends Error {
  readonly path: string;

  constructor(path: string, expected: string, received: string) {
    super(`Unexpected API response at ${path}: expected ${expected}, received ${received}`);
    this.name = 'UnexpectedResponseError';
    this.path = path;
  }
}

// ---------------------------------------------------------------------------
// Guards y lectores. Solo describen tipos, nunca valores.
// ---------------------------------------------------------------------------

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describeType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function expectObject(value: unknown, path: string): JsonObject {
  if (!isObject(value)) throw new UnexpectedResponseError(path, 'object', describeType(value));
  return value;
}

function readString(source: JsonObject, key: string, path: string): string {
  const value = source[key];
  if (typeof value !== 'string') throw new UnexpectedResponseError(`${path}.${key}`, 'string', describeType(value));
  return value;
}

function readNullableString(source: JsonObject, key: string, path: string): string | null {
  const value = source[key];
  if (value !== null && typeof value !== 'string') {
    throw new UnexpectedResponseError(`${path}.${key}`, 'string | null', describeType(value));
  }
  return value;
}

/** Conteos y puntuaciones: enteros en el contrato (int en el backend). */
function readInteger(source: JsonObject, key: string, path: string): number {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new UnexpectedResponseError(`${path}.${key}`, 'integer', describeType(value));
  }
  return value;
}

function readBoolean(source: JsonObject, key: string, path: string): boolean {
  const value = source[key];
  if (typeof value !== 'boolean') throw new UnexpectedResponseError(`${path}.${key}`, 'boolean', describeType(value));
  return value;
}

function readObject(source: JsonObject, key: string, path: string): JsonObject {
  return expectObject(source[key], `${path}.${key}`);
}

function readFixedArray<T>(
  source: JsonObject,
  key: string,
  path: string,
  length: number,
  parseItem: (item: unknown, itemPath: string) => T
): T[] {
  const value = source[key];
  const arrayPath = `${path}.${key}`;
  if (!Array.isArray(value)) throw new UnexpectedResponseError(arrayPath, 'array', describeType(value));
  if (value.length !== length) {
    throw new UnexpectedResponseError(arrayPath, `${length} items`, `${value.length} items`);
  }
  return value.map((item, index) => parseItem(item, `${arrayPath}[${index}]`));
}

// ---------------------------------------------------------------------------
// Piezas del contrato
// ---------------------------------------------------------------------------

function parseTotals(value: JsonObject, path: string): Totals {
  return {
    total_records: readInteger(value, 'total_records', path),
    valid_records: readInteger(value, 'valid_records', path),
    invalid_records: readInteger(value, 'invalid_records', path),
  };
}

function parseRuleItem(item: unknown, path: string): RuleBreakdownItem {
  const value = expectObject(item, path);
  return {
    code: readString(value, 'code', path),
    label: readString(value, 'label', path),
    count: readInteger(value, 'count', path),
  };
}

function parseDistributionItem(item: unknown, path: string): DistributionItem {
  const value = expectObject(item, path);
  return {
    code: readString(value, 'code', path),
    count: readInteger(value, 'count', path),
    percentage: readNullableString(value, 'percentage', path),
  };
}

function parseScoreItem(item: unknown, path: string): SatisfactionDistributionItem {
  const value = expectObject(item, path);
  return {
    score: readInteger(value, 'score', path),
    label: readString(value, 'label', path),
    count: readInteger(value, 'count', path),
  };
}

function parseSatisfaction(value: JsonObject, path: string): SatisfactionResult {
  return {
    closed_tickets: readInteger(value, 'closed_tickets', path),
    scored_tickets: readInteger(value, 'scored_tickets', path),
    average_score: readNullableString(value, 'average_score', path),
    distribution: readFixedArray(value, 'distribution', path, SCORE_COUNT, parseScoreItem),
  };
}

function parseExportInfo(value: JsonObject, path: string): ExportInfo {
  return {
    available: readBoolean(value, 'available', path),
    url: readString(value, 'url', path),
    filename: readString(value, 'filename', path),
    format: readString(value, 'format', path),
  };
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Respuesta 200 de `POST /api/incidents/analyze` → `AnalysisResult`.
 * Lanza `UnexpectedResponseError` si la forma no coincide con el contrato.
 */
export function normalizeAnalysisResponse(input: unknown): AnalysisResult {
  const root = 'response';
  const body = expectObject(input, root);
  return {
    analysis_id: readString(body, 'analysis_id', root),
    analyzed_at: readString(body, 'analyzed_at', root),
    totals: parseTotals(readObject(body, 'totals', root), `${root}.totals`),
    invalid_breakdown: readFixedArray(body, 'invalid_breakdown', root, RULE_COUNT, parseRuleItem),
    categories: readFixedArray(body, 'categories', root, CATEGORY_COUNT, parseDistributionItem),
    statuses: readFixedArray(body, 'statuses', root, STATUS_COUNT, parseDistributionItem),
    satisfaction: parseSatisfaction(readObject(body, 'satisfaction', root), `${root}.satisfaction`),
    export: parseExportInfo(readObject(body, 'export', root), `${root}.export`),
  };
}

/**
 * Cuerpo de error de la API → `{code, detail}` con solo los campos que sean
 * string. Nunca lanza: ante cualquier forma inesperada devuelve `null` en el
 * campo correspondiente. No copia nada más del cuerpo.
 */
export function normalizeApiErrorBody(input: unknown): ApiErrorBody {
  if (!isObject(input)) return { code: null, detail: null };
  const { code, detail } = input;
  return {
    code: typeof code === 'string' ? code : null,
    detail: typeof detail === 'string' ? detail : null,
  };
}
