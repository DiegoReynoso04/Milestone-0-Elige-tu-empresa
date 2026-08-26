// Servicio de candidaturas (records). Fuente: SPECS.md §5.2.
// Única capa que llama a apiClient; los componentes nunca lo hacen directamente.
// deleteRecord NO se implementa: fuera de alcance según REQ-4.

import { apiClient } from '@/lib/api-client';
import { normalizeRecord, normalizeRecordsPage } from '@/services/normalizers';
import type { RecordCreate, RecordListItem, RecordOut, RecordPatch } from '@/types/record';
import type { RecordQueryParams, RecordsPage } from '@/types/api';

export async function getRecords(params: RecordQueryParams): Promise<RecordsPage> {
  const data: unknown = await apiClient.get('/records', { ...params });
  return normalizeRecordsPage(data);
}

export async function getRecordById(id: string): Promise<RecordListItem> {
  const data: unknown = await apiClient.get(`/records/${encodeURIComponent(id)}`);
  return normalizeRecord(data);
}

export async function createRecord(body: RecordCreate): Promise<RecordOut> {
  const data: unknown = await apiClient.post('/records', body);
  return normalizeRecord(data);
}

export async function updateRecord(id: string, body: RecordCreate): Promise<RecordOut> {
  const data: unknown = await apiClient.put(`/records/${encodeURIComponent(id)}`, body);
  return normalizeRecord(data);
}

export async function patchRecord(id: string, body: RecordPatch): Promise<RecordOut> {
  const data: unknown = await apiClient.patch(`/records/${encodeURIComponent(id)}`, body);
  return normalizeRecord(data);
}
