// Transportes falsos para los tests del cliente y del servicio. Devuelven
// objetos `Response` reales de Node (sin librerías de mocking) y registran
// cada llamada para poder inspeccionar URL, método, cabeceras y cuerpo.

export const BASE_URL = 'http://api.test';
export const LEAK = 'leak.canary@example.invalid';

export function recordingFetch(makeResponse) {
  const calls = [];
  const responses = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    const response = makeResponse(url, init);
    responses.push(response);
    return response;
  };
  return { fetch, calls, responses };
}

export function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

export function textResponse(status, text, headers = {}) {
  return new Response(text, { status, headers: { 'content-type': 'text/plain', ...headers } });
}

/** Nunca responde: solo rechaza cuando se aborta la señal (como fetch real). */
export function hangingFetch() {
  return (url, init) =>
    new Promise((_, reject) => {
      const abort = () => reject(new DOMException('The operation was aborted.', 'AbortError'));
      if (init.signal.aborted) abort();
      else init.signal.addEventListener('abort', abort);
    });
}

/** Falla como fetch sin red o con CORS bloqueado. */
export function offlineFetch() {
  return async () => {
    throw new TypeError(`Failed to fetch ${LEAK}`);
  };
}

/** Respuesta 200 válida del contrato (services/api/SPECS.md §3.1). */
export function validAnalysis(analysisId = '7d3e0c2a-5b1f-4a57-9d0e-2f4c1b8a6e10') {
  return {
    analysis_id: analysisId,
    analyzed_at: '2026-09-23T10:15:00Z',
    totals: { total_records: 13, valid_records: 8, invalid_records: 5 },
    invalid_breakdown: [
      { code: 'missing_client_company', label: 'Missing client_company', count: 2 },
      { code: 'invalid_category', label: 'Invalid or missing category', count: 1 },
      { code: 'invalid_description', label: 'Invalid or missing description', count: 1 },
      { code: 'invalid_agent_id', label: 'Invalid or missing agent_id', count: 1 },
      { code: 'invalid_email', label: 'Invalid or missing email', count: 2 },
      { code: 'closed_without_score', label: 'Closed ticket, no score', count: 1 },
      { code: 'score_out_of_range', label: 'Score out of range', count: 1 },
    ],
    categories: [
      { code: 'TECHNICAL', count: 2, percentage: '25.0' },
      { code: 'BILLING', count: 2, percentage: '25.0' },
      { code: 'ACCESS', count: 1, percentage: '12.5' },
      { code: 'HR_QUERY', count: 1, percentage: '12.5' },
      { code: 'COMPLAINT', count: 2, percentage: '25.0' },
    ],
    statuses: [
      { code: 'OPEN', count: 2, percentage: '25.0' },
      { code: 'CLOSED', count: 4, percentage: '50.0' },
      { code: 'DISCARDED', count: 1, percentage: '12.5' },
    ],
    satisfaction: {
      closed_tickets: 4,
      scored_tickets: 4,
      average_score: '3.75',
      distribution: [
        { score: 1, label: 'Very dissatisfied', count: 0 },
        { score: 2, label: 'Dissatisfied', count: 1 },
        { score: 3, label: 'Neutral', count: 0 },
        { score: 4, label: 'Satisfied', count: 2 },
        { score: 5, label: 'Very satisfied', count: 1 },
      ],
    },
    export: { available: true, url: '/api/incidents/results/export', filename: 'results.csv', format: 'metric,value' },
  };
}

/**
 * File que falla si alguien intenta leer su contenido desde JavaScript
 * (text/arrayBuffer/bytes/stream). Cuenta los intentos.
 */
export class UnreadableFile extends File {
  constructor(parts, name, options) {
    super(parts, name, options);
    this.readAttempts = 0;
  }
  text() { this.readAttempts += 1; throw new Error('file content must not be read'); }
  arrayBuffer() { this.readAttempts += 1; throw new Error('file content must not be read'); }
  bytes() { this.readAttempts += 1; throw new Error('file content must not be read'); }
  stream() { this.readAttempts += 1; throw new Error('file content must not be read'); }
}

export function csvFile(name = 'incidents.csv', size = 64) {
  return new UnreadableFile([new Uint8Array(size)], name, { type: 'text/csv' });
}
