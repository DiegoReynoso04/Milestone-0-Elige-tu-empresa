import Link from 'next/link';
import { StageBadge, StatusBadge } from '@/components/ui/badge';
import type { RecordListItem } from '@/types/record';

export interface CandidateTableProps {
  records: RecordListItem[];
}

const LINK_CLASSES =
  'text-brand underline-offset-2 hover:underline outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

// Vista de escritorio: <table> real con <th scope="col">. Oculta en móvil
// vía CSS (display:none la saca del árbol de accesibilidad); candidate-card
// cubre esa vista con la misma información.
export function CandidateTable({ records }: CandidateTableProps) {
  return (
    <div className="hidden overflow-x-auto rounded-control border border-border bg-surface md:block">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-ink-muted">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Nombre</th>
            <th scope="col" className="px-4 py-3 font-medium">Puesto</th>
            <th scope="col" className="px-4 py-3 font-medium">Estado</th>
            <th scope="col" className="px-4 py-3 font-medium">Etapa</th>
            <th scope="col" className="px-4 py-3 font-medium">
              <span className="sr-only">Detalle</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {records.map((record) => (
            <tr key={record.id}>
              <td className="px-4 py-3 font-medium text-ink">{record.full_name}</td>
              <td className="px-4 py-3 text-ink-muted">{record.position}</td>
              <td className="px-4 py-3">
                <StatusBadge status={record.status} />
              </td>
              <td className="px-4 py-3">
                <StageBadge stage={record.stage} />
              </td>
              <td className="px-4 py-3 text-right">
                <Link href={`/candidates/${record.id}`} className={LINK_CLASSES}>
                  Ver detalle
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
