import { Button } from '@/components/ui/button';
import type { AnalysisResult, UiError } from '@/types/incidents';

import { AnalysisError } from './analysis-error';

export interface AnalysisMetaProps {
  result: AnalysisResult;
  isExporting: boolean;
  exportError: UiError | null;
  onExport: () => void;
}

const dateFormatter = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'medium' });

/** Solo presentación: si la fecha no se puede interpretar se muestra tal cual llegó. */
function formatAnalyzedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

export function AnalysisMeta({ result, isExporting, exportError, onExport }: AnalysisMetaProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-ink-muted sm:grid-cols-[auto_1fr]">
          <dt>Fecha del análisis</dt>
          <dd className="text-ink">
            <time dateTime={result.analyzed_at}>{formatAnalyzedAt(result.analyzed_at)}</time>
          </dd>
          <dt>Identificador</dt>
          <dd className="font-mono break-all text-ink">{result.analysis_id}</dd>
        </dl>
        <Button
          variant="secondary"
          onClick={onExport}
          disabled={!result.export.available}
          isLoading={isExporting}
          className="shrink-0"
        >
          {isExporting ? 'Descargando…' : `Descargar ${result.export.filename}`}
        </Button>
      </div>
      {exportError !== null && <AnalysisError error={exportError} />}
    </div>
  );
}
