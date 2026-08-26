import Link from 'next/link';
import { StageBadge, StatusBadge } from '@/components/ui/badge';
import type { RecordListItem } from '@/types/record';

export interface CandidateCardProps {
  record: RecordListItem;
}

// Vista de móvil: tarjeta en vez de fila de tabla (candidate-table.tsx cubre
// escritorio). Pensada como <li> dentro del <ul> que arma candidate-list.
export function CandidateCard({ record }: CandidateCardProps) {
  return (
    <li className="rounded-control border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-ink">{record.full_name}</h3>
        <StatusBadge status={record.status} />
      </div>
      <p className="mt-1 text-sm text-ink-muted">{record.position}</p>
      <div className="mt-2">
        <StageBadge stage={record.stage} />
      </div>
      <Link
        href={`/candidates/${record.id}`}
        className="mt-3 inline-block text-sm text-brand underline-offset-2 outline-none hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        Ver detalle
      </Link>
    </li>
  );
}
