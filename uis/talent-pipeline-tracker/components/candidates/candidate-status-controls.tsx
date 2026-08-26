'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { Select, type SelectOption } from '@/components/ui/select';
import { STAGE_META, STATUS_META } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast-notification';
import { describeApiError } from '@/lib/api-client';
import { patchRecord } from '@/services/records.service';
import { KNOWN_STAGES, KNOWN_STATUSES } from '@/types/known-values';
import type { RecordOut, RecordStage, RecordStatus } from '@/types/record';

export interface CandidateStatusControlsProps {
  id: string;
  status: RecordStatus;
  stage: RecordStage;
  onUpdated: (record: RecordOut) => void;
}

interface StatusStageState {
  status: RecordStatus;
  stage: RecordStage;
}

type StatusStagePatch = Partial<StatusStageState>;

const STATUS_OPTIONS: SelectOption[] = KNOWN_STATUSES.map((value) => ({
  value,
  label: STATUS_META[value].label,
}));

const STAGE_OPTIONS: SelectOption[] = KNOWN_STAGES.map((value) => ({
  value,
  label: STAGE_META[value].label,
}));

// Si el valor actual no es uno de los conocidos (§4.1), se añade como
// opción extra para no mentir sobre el estado real del registro: el
// <select> nunca debe mostrar seleccionado un valor distinto al real.
function withCurrentValue(options: SelectOption[], current: string): SelectOption[] {
  return options.some((option) => option.value === current)
    ? options
    : [...options, { value: current, label: current }];
}

// PATCH /records/{id}, solo status/stage (REQ-3, REQ-5). Actualización
// optimista con useOptimistic: el selector muestra el nuevo valor al
// instante. Si la petición falla, `committed` nunca llega a cambiar, así
// que useOptimistic revierte solo al valor confirmado en cuanto termina la
// transición — y el error se anuncia por el toast (aria-live="assertive"):
// la reversión silenciosa no es aceptable. Éxito y error van al toast
// (REQ-4/REQ-5); el try/catch es directo aquí, sin pasar por un estado
// intermedio, así que el mensaje del catch nunca queda obsoleto.
export function CandidateStatusControls({ id, status, stage, onUpdated }: CandidateStatusControlsProps) {
  const [committed, setCommitted] = useState<StatusStageState>({ status, stage });
  const [optimistic, setOptimistic] = useOptimistic(
    committed,
    (state: StatusStageState, patch: StatusStagePatch): StatusStageState => ({ ...state, ...patch })
  );
  const [isPending, startTransition] = useTransition();
  const { notifySuccess, notifyError } = useToast();

  function submitPatch(patch: StatusStagePatch) {
    if (isPending) return; // bloquea envíos duplicados mientras hay una mutación en curso

    startTransition(async () => {
      setOptimistic(patch);
      try {
        const updated = await patchRecord(id, patch);
        setCommitted({ status: updated.status, stage: updated.stage });
        notifySuccess('status' in patch ? 'Estado actualizado.' : 'Etapa actualizada.');
        onUpdated(updated);
      } catch (err) {
        notifyError(describeApiError(err));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-control border border-border bg-surface p-4 sm:flex-row">
      <Select
        label="Estado"
        value={optimistic.status}
        disabled={isPending}
        onChange={(event) => submitPatch({ status: event.target.value })}
        options={withCurrentValue(STATUS_OPTIONS, optimistic.status)}
      />
      <Select
        label="Etapa"
        value={optimistic.stage}
        disabled={isPending}
        onChange={(event) => submitPatch({ stage: event.target.value })}
        options={withCurrentValue(STAGE_OPTIONS, optimistic.stage)}
      />
    </div>
  );
}
