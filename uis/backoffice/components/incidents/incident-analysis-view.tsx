'use client';

// Vista de /incidents: conecta el hook con componentes presentacionales.
// No hace HTTP ni lee el archivo: todo pasa por useIncidentAnalysis y, para la
// ayuda inmediata de extensión/tamaño, por la misma prevalidación del servicio.

import { useEffect, useRef } from 'react';

import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useIncidentAnalysis } from '@/hooks/use-incident-analysis';
import { precheckFile } from '@/services/incidents.service';

import { AnalysisError } from './analysis-error';
import { AnalysisMeta } from './analysis-meta';
import { DistributionTable } from './distribution-table';
import { InvalidBreakdownTable } from './invalid-breakdown-table';
import { SatisfactionPanel } from './satisfaction-panel';
import { TotalsCards } from './totals-cards';
import { UploadForm } from './upload-form';

export function IncidentAnalysisView() {
  const { file, result, analysis, exporting, analysisError, exportError, selectFile, analyze, exportResults } =
    useIncidentAnalysis();

  // Derivado en cada render (no se guarda): misma regla que aplica el servicio.
  const precheckError = file === null ? null : precheckFile(file);
  const isAnalyzing = analysis.status === 'loading';
  const isExporting = exporting.status === 'loading';

  // Al aparecer un resultado nuevo, el foco va a su encabezado.
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const analysisId = result?.analysis_id;
  useEffect(() => {
    if (analysisId !== undefined) resultsHeadingRef.current?.focus();
  }, [analysisId]);

  let liveMessage = '';
  if (isAnalyzing) liveMessage = 'Analizando el archivo…';
  else if (analysis.status === 'success') liveMessage = 'Análisis completado.';
  if (isExporting) liveMessage = 'Preparando la descarga…';
  else if (exporting.status === 'success' && result !== null) liveMessage = `Descarga de ${result.export.filename} iniciada.`;

  return (
    <>
      {/* Anuncios de estado para lectores de pantalla; los errores se anuncian con role="alert". */}
      <p role="status" className="sr-only">
        {liveMessage}
      </p>

      <section aria-labelledby="upload-heading" className="rounded-lg border border-border bg-surface p-4 sm:p-6">
        <h2 id="upload-heading" className="text-base font-semibold text-ink">
          Archivo
        </h2>
        <div className="mt-4 flex flex-col gap-4">
          <UploadForm
            file={file}
            precheckError={precheckError}
            isAnalyzing={isAnalyzing}
            onFileChange={selectFile}
            onAnalyze={analyze}
          />
          {analysisError !== null && (
            <div className="flex flex-col gap-2">
              <AnalysisError error={analysisError} />
              {result !== null && (
                <p className="text-xs text-ink-muted">Se siguen mostrando los resultados del análisis anterior.</p>
              )}
            </div>
          )}
        </div>
      </section>

      {result === null ? (
        <section
          aria-labelledby="results-empty-heading"
          className="rounded-lg border border-dashed border-border bg-surface p-6 text-center"
        >
          {isAnalyzing ? (
            <div className="flex flex-col items-center gap-3">
              <LoadingSpinner />
              <h2 id="results-empty-heading" className="text-sm font-medium text-ink">
                Analizando el archivo…
              </h2>
            </div>
          ) : (
            <>
              <h2 id="results-empty-heading" className="text-sm font-medium text-ink">
                Todavía no hay resultados
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                Selecciona el CSV de incidentes y pulsa «Analizar» para ver las métricas.
              </p>
            </>
          )}
        </section>
      ) : (
        <section aria-labelledby="results-heading" className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h2
              id="results-heading"
              ref={resultsHeadingRef}
              tabIndex={-1}
              className="text-base font-semibold text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Resultados
            </h2>
            {isAnalyzing && (
              <Alert variant="info" title="Analizando un archivo nuevo">
                <p>Mientras tanto se muestran los resultados del análisis anterior.</p>
              </Alert>
            )}
            <AnalysisMeta result={result} isExporting={isExporting} exportError={exportError} onExport={exportResults} />
          </div>

          <TotalsCards totals={result.totals} />
          <InvalidBreakdownTable items={result.invalid_breakdown} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DistributionTable
              headingId="categories-heading"
              title="Categorías"
              codeLabel="Categoría"
              items={result.categories}
              note="Registros válidos por categoría; porcentaje sobre registros válidos."
            />
            <DistributionTable
              headingId="statuses-heading"
              title="Estados"
              codeLabel="Estado"
              items={result.statuses}
              note="Registros válidos por estado; porcentaje sobre registros válidos."
            />
          </div>
          <SatisfactionPanel satisfaction={result.satisfaction} />
        </section>
      )}
    </>
  );
}
