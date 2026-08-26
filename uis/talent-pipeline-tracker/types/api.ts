// Envoltorios de respuesta, parámetros y errores. Fuente: SPECS.md §4.
// Tres formatos de envoltorio distintos entre endpoints (§4.8.4): sin envoltorio genérico.

import type { RecordListItem, Note } from '@/types/record';

// Observado 2026-08-26 — GET /records, no declarado en OpenAPI (§4.8.1)
export interface RecordsPage {
  total: number;
  page: number;
  limit: number;
  data: RecordListItem[];
}

// Observado 2026-08-26 — GET /records/{id}/notes, no declarado en OpenAPI (§4.8.3)
export interface NotesResponse {
  data: Note[];
  meta: { total: number };
}

// OpenAPI — parámetros de consulta de GET /records (§4.6)
export interface RecordQueryParams {
  status?: string;
  stage?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// OpenAPI — errores de validación, HTTP 422 (§4.7)
export interface ValidationError {
  loc: Array<string | number>;
  msg: string;
  type: string;
}

export interface HTTPValidationError {
  detail?: ValidationError[];
}
