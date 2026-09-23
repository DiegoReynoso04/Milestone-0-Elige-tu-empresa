import { useId, type ChangeEvent, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import type { UiError } from '@/types/incidents';

import { AnalysisError } from './analysis-error';

export interface UploadFormProps {
  /** Referencia al archivo elegido: solo se muestran su nombre y tamaño. */
  file: File | null;
  /** Rechazo inmediato de la prevalidación del servicio (extensión/tamaño), si lo hay. */
  precheckError: UiError | null;
  isAnalyzing: boolean;
  onFileChange: (file: File | null) => void;
  onAnalyze: () => void;
}

const sizeFormatter = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${sizeFormatter.format(bytes / 1024)} KB`;
  return `${sizeFormatter.format(bytes / (1024 * 1024))} MB`;
}

export function UploadForm({ file, precheckError, isAnalyzing, onFileChange, onAnalyze }: UploadFormProps) {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    // Solo se toma la referencia al File; su contenido nunca se lee aquí.
    onFileChange(event.target.files?.[0] ?? null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAnalyze();
  }

  const canAnalyze = file !== null && precheckError === null && !isAnalyzing;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          Archivo CSV de incidentes
        </label>
        <input
          id={inputId}
          name="file"
          type="file"
          accept=".csv,text/csv"
          onChange={handleChange}
          disabled={isAnalyzing}
          aria-describedby={precheckError === null ? hintId : `${hintId} ${errorId}`}
          aria-invalid={precheckError !== null || undefined}
          className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-control file:border file:border-border file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
        />
        <p id={hintId} className="text-xs text-ink-muted">
          CSV en UTF-8 con fila de cabecera. El tamaño máximo lo fija la API (aproximadamente 1 MiB).
        </p>
      </div>

      {file !== null && (
        <p className="text-sm text-ink">
          Seleccionado: <span className="font-medium break-all">{file.name}</span>{' '}
          <span className="text-ink-muted">({formatBytes(file.size)})</span>
        </p>
      )}

      {precheckError !== null && <AnalysisError error={precheckError} id={errorId} />}

      <div>
        <Button type="submit" disabled={!canAnalyze} isLoading={isAnalyzing}>
          {isAnalyzing ? 'Analizando…' : 'Analizar'}
        </Button>
      </div>
    </form>
  );
}
