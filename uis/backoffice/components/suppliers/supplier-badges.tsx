import type { RenewalInfo } from '@/lib/supplier-renewal';
import type { SupplierStatus } from '@/types/suppliers';

import { formatDate } from './format';

const STATUS_CLASSES: Record<SupplierStatus, string> = {
  active: 'border-success-ink/30 bg-success-surface text-success-ink',
  suspended: 'border-danger-ink/30 bg-danger-surface text-danger-ink',
};

// El estado se muestra con el valor del dominio (en inglés, como lo devuelve la
// API) y con un símbolo además del color, para no depender solo del color.
export function StatusBadge({ status }: { status: SupplierStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}
    >
      <span aria-hidden="true">{status === 'active' ? '●' : '○'}</span>
      {status}
    </span>
  );
}

export interface RenewalCellProps {
  date: string | null;
  info: RenewalInfo;
}

/** Fecha de renovación; destacada si cae en los próximos 60 días. */
export function RenewalCell({ date, info }: RenewalCellProps) {
  if (date === null) return <span className="text-ink-muted">—</span>;
  if (info.kind !== 'upcoming') return <span className="text-ink-muted">{formatDate(date)}</span>;
  const when = info.daysLeft === 0 ? 'hoy' : info.daysLeft === 1 ? 'en 1 día' : `en ${info.daysLeft} días`;
  return (
    <span className="inline-flex flex-col gap-1">
      <span className="font-medium text-ink">{formatDate(date)}</span>
      <span className="inline-flex w-fit items-center gap-1 rounded-full border border-warning-ink/30 bg-warning-surface px-2 py-0.5 text-xs font-medium text-warning-ink">
        <span aria-hidden="true">⚠</span>
        Renueva {when}
      </span>
    </span>
  );
}
