import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { STAGE_META, STATUS_META } from '@/components/ui/badge';
import { KNOWN_STAGES, KNOWN_STATUSES } from '@/types/known-values';
import type { KnownStage, KnownStatus } from '@/types/record';

export interface CandidateFiltersProps {
  statusFilter: KnownStatus | '';
  onStatusFilterChange: (status: KnownStatus | '') => void;
  stageFilter: KnownStage | '';
  onStageFilterChange: (stage: KnownStage | '') => void;
  search: string;
  onSearchChange: (value: string) => void;
}

const STATUS_OPTIONS = KNOWN_STATUSES.map((status) => ({
  value: status,
  label: STATUS_META[status].label,
}));

const STAGE_OPTIONS = KNOWN_STAGES.map((stage) => ({
  value: stage,
  label: STAGE_META[stage].label,
}));

// Solo presentación: el estado de filtros/búsqueda vive en el hook use-records.
// <search> es el landmark real de HTML para esto; no hace falta role="search".
export function CandidateFilters({
  statusFilter,
  onStatusFilterChange,
  stageFilter,
  onStageFilterChange,
  search,
  onSearchChange,
}: CandidateFiltersProps) {
  return (
    <search aria-label="Filtrar candidaturas" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Select
        label="Estado"
        placeholder="Todos los estados"
        value={statusFilter}
        onChange={(event) => onStatusFilterChange(event.target.value as KnownStatus | '')}
        options={STATUS_OPTIONS}
      />
      <Select
        label="Etapa"
        placeholder="Todas las etapas"
        value={stageFilter}
        onChange={(event) => onStageFilterChange(event.target.value as KnownStage | '')}
        options={STAGE_OPTIONS}
      />
      <Input
        label="Buscar"
        type="search"
        placeholder="Nombre o email"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
    </search>
  );
}
