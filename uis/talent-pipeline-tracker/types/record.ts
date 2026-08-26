// Tipos de dominio: candidatura (Record) y notas. Fuente: SPECS.md §4.

// OpenAPI — string libre; valores conocidos documentados en la descripción (§4.1)
export type KnownStatus =
  | 'received'
  | 'in_progress'
  | 'selected'
  | 'discarded';

export type KnownStage =
  | 'pending'
  | 'review'
  | 'personal_interview'
  | 'technical_interview'
  | 'offer_presented';

// Acepta cualquier string (fiel al contrato) pero autocompleta los conocidos
export type RecordStatus = KnownStatus | (string & {});
export type RecordStage = KnownStage | (string & {});

// OpenAPI — schema RecordOut (§4.2)
export interface RecordOut {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  position: string;
  linkedin_url: string | null;
  cv_url: string | null;
  status: RecordStatus;
  stage: RecordStage;
  experience_years: number;
  notes_count: number;
  applied_at: string;
  updated_at: string;
}

// OpenAPI — POST /records y PUT /records/{id} (§4.3)
export interface RecordCreate {
  full_name: string;
  email: string;
  phone: string;
  position: string;
  linkedin_url?: string | null;
  cv_url?: string | null;
  experience_years: number;
}

// OpenAPI — PATCH /records/{id}, solo status y stage (§4.4)
export interface RecordPatch {
  status?: RecordStatus | null;
  stage?: RecordStage | null;
}

// OpenAPI — schema NoteCreate (§4.5)
export interface NoteCreate {
  content: string; // minLength: 1
}

// Observado 2026-08-26 — no declarado en OpenAPI (§4.8.3)
export interface Note {
  id: string; // usado como {note_id} en el DELETE
  record_id: string;
  content: string;
  created_at: string;
}

// Observado 2026-08-26 — RecordOut + `notes`, ausente del schema OpenAPI (§4.8.1)
export interface RecordListItem extends RecordOut {
  notes: Note[];
}
