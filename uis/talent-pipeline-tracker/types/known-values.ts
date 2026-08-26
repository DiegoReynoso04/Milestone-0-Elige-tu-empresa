// Valores conocidos de status/stage derivados de KnownStatus/KnownStage,
// para filtros y selectores de la UI (REQ-2).

import type { KnownStatus, KnownStage } from '@/types/record';

export const KNOWN_STATUSES: readonly KnownStatus[] = [
  'received',
  'in_progress',
  'selected',
  'discarded',
] as const;

export const KNOWN_STAGES: readonly KnownStage[] = [
  'pending',
  'review',
  'personal_interview',
  'technical_interview',
  'offer_presented',
] as const;
