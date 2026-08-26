import type { ReactNode } from 'react';
import type { KnownStage, KnownStatus, RecordStage, RecordStatus } from '@/types/record';

type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-surface text-neutral-ink',
  info: 'bg-info-surface text-info-ink',
  success: 'bg-success-surface text-success-ink',
  warning: 'bg-warning-surface text-warning-ink',
  danger: 'bg-danger-surface text-danger-ink',
};

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
}

// Primitivo genérico: el texto siempre está presente, el color es solo
// refuerzo visual, nunca el único portador de significado.
export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-control px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}

// §4.1 / CONTEXT-HITO3.md — etiqueta y tono por valor conocido. Un valor
// desconocido cae al caso por defecto: tono neutral, texto crudo, sin romper.
export const STATUS_META: Record<KnownStatus, { label: string; tone: BadgeTone }> = {
  received: { label: 'Recibida', tone: 'neutral' },
  in_progress: { label: 'En proceso', tone: 'info' },
  selected: { label: 'Seleccionada', tone: 'success' },
  discarded: { label: 'Descartada', tone: 'danger' },
};

export const STAGE_META: Record<KnownStage, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Pendiente de revisión', tone: 'neutral' },
  review: { label: 'En revisión', tone: 'info' },
  personal_interview: { label: 'Entrevista personal', tone: 'warning' },
  technical_interview: { label: 'Entrevista técnica', tone: 'warning' },
  offer_presented: { label: 'Oferta presentada', tone: 'success' },
};

function isKnownStatus(value: RecordStatus): value is KnownStatus {
  return value in STATUS_META;
}

function isKnownStage(value: RecordStage): value is KnownStage {
  return value in STAGE_META;
}

export function StatusBadge({ status }: { status: RecordStatus }) {
  const meta = isKnownStatus(status) ? STATUS_META[status] : { label: status, tone: 'neutral' as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function StageBadge({ stage }: { stage: RecordStage }) {
  const meta = isKnownStage(stage) ? STAGE_META[stage] : { label: stage, tone: 'neutral' as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
