import { Button } from '@/components/ui/button';

export interface CandidatePaginationProps {
  page: number;
  limit: number;
  total: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onPageChange: (page: number) => void;
}

export function CandidatePagination({
  page,
  limit,
  total,
  hasNextPage,
  hasPreviousPage,
  onPageChange,
}: CandidatePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <nav aria-label="Paginación de candidaturas" className="flex items-center justify-between gap-4">
      <Button variant="secondary" disabled={!hasPreviousPage} onClick={() => onPageChange(page - 1)}>
        Anterior
      </Button>
      <p className="text-sm text-ink-muted">
        Página {page} de {totalPages}
      </p>
      <Button variant="secondary" disabled={!hasNextPage} onClick={() => onPageChange(page + 1)}>
        Siguiente
      </Button>
    </nav>
  );
}
