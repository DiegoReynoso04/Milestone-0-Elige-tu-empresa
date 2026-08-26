// Servicio de notas internas de una candidatura. Fuente: SPECS.md §5.3.

import { apiClient } from '@/lib/api-client';
import { normalizeNote, normalizeNotesResponse } from '@/services/normalizers';
import type { Note, NoteCreate } from '@/types/record';
import type { NotesResponse } from '@/types/api';

export async function getNotes(recordId: string): Promise<NotesResponse> {
  const data: unknown = await apiClient.get(`/records/${encodeURIComponent(recordId)}/notes`);
  return normalizeNotesResponse(data);
}

export async function addNote(recordId: string, body: NoteCreate): Promise<Note> {
  const data: unknown = await apiClient.post(
    `/records/${encodeURIComponent(recordId)}/notes`,
    body
  );
  return normalizeNote(data);
}

export async function deleteNote(recordId: string, noteId: string): Promise<void> {
  await apiClient.del(
    `/records/${encodeURIComponent(recordId)}/notes/${encodeURIComponent(noteId)}`
  );
}
