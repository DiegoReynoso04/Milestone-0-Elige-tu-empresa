import type { Totals } from '@/types/incidents';

export interface TotalsCardsProps {
  totals: Totals;
}

// Valores tal cual llegan de la API: no se recalcula nada.
export function TotalsCards({ totals }: TotalsCardsProps) {
  const cards = [
    { label: 'Total de registros', value: totals.total_records },
    { label: 'Registros válidos', value: totals.valid_records },
    { label: 'Registros inválidos', value: totals.invalid_records },
  ];

  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-border bg-surface p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{card.label}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{card.value}</dd>
        </div>
      ))}
    </dl>
  );
}
