// Estado de la vista /incidents: archivo seleccionado, análisis y exportación.
// Solo consume services/incidents.service.ts (nunca HTTP directo).
//
// Tres piezas en este archivo:
//   1. `incidentAnalysisReducer`: transiciones de estado puras.
//   2. `createIncidentAnalysisSession`: operaciones asíncronas, cancelación y
//      carreras. Sin React, para poder probarla con `node --test`.
//   3. `useIncidentAnalysis`: une ambas con hooks nativos de React.
//
// Principio de carreras: solo la operación que siga siendo válida para el
// estado actual puede cambiar ese estado o iniciar una descarga.
//   - Análisis: cada ejecución nueva aborta la anterior; una respuesta de una
//     ejecución que ya no es la última se descarta aunque llegue.
//   - Si un análisis falla, el resultado anterior sigue visible.
//   - Exportación: va ligada al `analysis_id` mostrado. Si ese resultado cambia
//     (llega un análisis nuevo correcto), la exportación en curso se aborta y
//     nunca descarga. Un análisis nuevo que falla no la afecta: sigue siendo
//     válida para el resultado que se muestra.
//   - La cancelación (`ApiAbortError`) no es un error para el usuario.
//   - Tras desmontar no se despacha nada y se abortan las peticiones activas.
//
// Privacidad: el estado solo guarda la referencia al `File` (sin leerlo) y el
// `AnalysisResult` normalizado. El Blob exportado vive solo durante la descarga.

import { useCallback, useEffect, useReducer, useState } from 'react';

import { ApiAbortError } from '@/lib/api-client';
import {
  IncidentServiceError,
  analyzeIncidentFile,
  exportIncidentResults,
} from '@/services/incidents.service';
import type { AnalysisResult, UiError } from '@/types/incidents';

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

/** Estado de una operación. El error solo existe en el estado `error`. */
export type OperationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success' }
  | { status: 'error'; error: UiError };

export interface IncidentAnalysisState {
  /** Referencia al archivo elegido. Nunca se lee ni se serializa. */
  file: File | null;
  /** Último análisis correcto. Un fallo posterior no lo borra. */
  result: AnalysisResult | null;
  analysis: OperationState;
  exporting: OperationState;
}

export type IncidentAnalysisAction =
  | { type: 'file_selected'; file: File | null }
  | { type: 'analysis_started' }
  | { type: 'analysis_succeeded'; result: AnalysisResult }
  | { type: 'analysis_failed'; error: UiError }
  | { type: 'export_started' }
  | { type: 'export_succeeded' }
  | { type: 'export_failed'; error: UiError }
  | { type: 'export_cancelled' }
  | { type: 'errors_cleared' };

const IDLE: OperationState = { status: 'idle' };

export const INITIAL_INCIDENT_ANALYSIS_STATE: IncidentAnalysisState = {
  file: null,
  result: null,
  analysis: IDLE,
  exporting: IDLE,
};

function withoutError(operation: OperationState): OperationState {
  return operation.status === 'error' ? IDLE : operation;
}

export function incidentAnalysisReducer(
  state: IncidentAnalysisState,
  action: IncidentAnalysisAction
): IncidentAnalysisState {
  switch (action.type) {
    case 'file_selected':
      // Elegir otro archivo descarta el error del intento anterior, no el resultado.
      return { ...state, file: action.file, analysis: withoutError(state.analysis) };
    case 'analysis_started':
      return { ...state, analysis: { status: 'loading' } };
    case 'analysis_succeeded':
      // Nuevo resultado visible: cualquier estado de exportación era del anterior.
      return { ...state, result: action.result, analysis: { status: 'success' }, exporting: IDLE };
    case 'analysis_failed':
      return { ...state, analysis: { status: 'error', error: action.error } };
    case 'export_started':
      return { ...state, exporting: { status: 'loading' } };
    case 'export_succeeded':
      return { ...state, exporting: { status: 'success' } };
    case 'export_failed':
      return { ...state, exporting: { status: 'error', error: action.error } };
    case 'export_cancelled':
      return { ...state, exporting: IDLE };
    case 'errors_cleared':
      return { ...state, analysis: withoutError(state.analysis), exporting: withoutError(state.exporting) };
  }
}

// ---------------------------------------------------------------------------
// Sesión: operaciones asíncronas, cancelación y carreras
// ---------------------------------------------------------------------------

export interface IncidentAnalysisDependencies {
  analyzeIncidentFile: typeof analyzeIncidentFile;
  exportIncidentResults: typeof exportIncidentResults;
  /** Entrega el archivo al usuario. Por defecto, enlace temporal + revocación. */
  downloadFile: (blob: Blob, filename: string) => void;
}

export interface IncidentAnalysisSession {
  /** Habilita el despacho (montaje). Idempotente; compatible con StrictMode. */
  activate(): void;
  /** Desmontaje: aborta todo y deja de despachar. */
  dispose(): void;
  selectFile(file: File | null): void;
  analyze(file: File | null): Promise<void>;
  exportResults(): Promise<void>;
  clearErrors(): void;
}

// Retardo antes de revocar la URL del Blob: algunos navegadores inician la
// descarga de forma asíncrona tras el click.
const REVOKE_DELAY_MS = 1_000;

/** Descarga local: el Blob no sale del navegador ni se guarda en ningún estado. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

const DEFAULT_DEPENDENCIES: IncidentAnalysisDependencies = {
  analyzeIncidentFile,
  exportIncidentResults,
  downloadFile: downloadBlob,
};

/** Sin archivo no hay petición posible: se muestra como petición no válida. */
const NO_FILE_ERROR: UiError = { kind: 'request_invalid' };
/** Exportar sin un análisis mostrado. */
const NO_RESULT_ERROR: UiError = { kind: 'no_analysis' };
/** Error del servicio → UiError; cualquier otro fallo, sin reenviar su texto. */
const FALLBACK_ERROR: UiError = { kind: 'unexpected_response' };

export function createIncidentAnalysisSession(
  dispatch: (action: IncidentAnalysisAction) => void,
  dependencies: IncidentAnalysisDependencies = DEFAULT_DEPENDENCIES
): IncidentAnalysisSession {
  let active = false;

  // Cada operación tiene un número de ejecución: solo la última puede despachar.
  let analysisRun = 0;
  let analysisController: AbortController | null = null;
  let exportRun = 0;
  let exportController: AbortController | null = null;
  // `analysis_id` del resultado mostrado; lo fija solo un análisis correcto vigente.
  let displayedAnalysisId: string | null = null;

  function emit(action: IncidentAnalysisAction): void {
    if (active) dispatch(action);
  }

  function invalidateAnalysis(): void {
    analysisRun += 1;
    analysisController?.abort();
    analysisController = null;
  }

  function invalidateExport(): void {
    exportRun += 1;
    exportController?.abort();
    exportController = null;
  }

  return {
    activate() {
      active = true;
    },

    dispose() {
      active = false;
      invalidateAnalysis();
      invalidateExport();
    },

    selectFile(file) {
      emit({ type: 'file_selected', file });
    },

    async analyze(file) {
      if (!active) return;
      if (file === null) {
        emit({ type: 'analysis_failed', error: NO_FILE_ERROR });
        return;
      }

      invalidateAnalysis();
      const run = analysisRun;
      const controller = new AbortController();
      analysisController = controller;
      emit({ type: 'analysis_started' });

      try {
        const result = await dependencies.analyzeIncidentFile(file, { signal: controller.signal });
        if (!active || run !== analysisRun) return;
        // El resultado visible cambia: la exportación del anterior queda obsoleta.
        invalidateExport();
        displayedAnalysisId = result.analysis_id;
        emit({ type: 'analysis_succeeded', result });
      } catch (error) {
        if (!active || run !== analysisRun || error instanceof ApiAbortError) return;
        emit({ type: 'analysis_failed', error: error instanceof IncidentServiceError ? error.uiError : FALLBACK_ERROR });
      } finally {
        if (analysisController === controller) analysisController = null;
      }
    },

    async exportResults() {
      if (!active) return;
      const expectedAnalysisId = displayedAnalysisId;
      if (expectedAnalysisId === null) {
        emit({ type: 'export_failed', error: NO_RESULT_ERROR });
        return;
      }

      invalidateExport();
      const run = exportRun;
      const controller = new AbortController();
      exportController = controller;
      emit({ type: 'export_started' });

      try {
        const exported = await dependencies.exportIncidentResults(expectedAnalysisId, { signal: controller.signal });
        if (!active || run !== exportRun) return;
        // Segunda barrera: nunca descargar algo que no sea el resultado mostrado.
        if (exported.analysisId !== displayedAnalysisId) {
          emit({ type: 'export_cancelled' });
          return;
        }
        dependencies.downloadFile(exported.blob, exported.filename);
        emit({ type: 'export_succeeded' });
      } catch (error) {
        if (!active || run !== exportRun || error instanceof ApiAbortError) return;
        emit({ type: 'export_failed', error: error instanceof IncidentServiceError ? error.uiError : FALLBACK_ERROR });
      } finally {
        if (exportController === controller) exportController = null;
      }
    },

    clearErrors() {
      emit({ type: 'errors_cleared' });
    },
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseIncidentAnalysisResult {
  file: File | null;
  result: AnalysisResult | null;
  analysis: OperationState;
  exporting: OperationState;
  /** Derivados de `analysis`/`exporting` (no se guardan aparte). */
  analysisError: UiError | null;
  exportError: UiError | null;
  selectFile: (file: File | null) => void;
  analyze: () => void;
  exportResults: () => void;
  clearErrors: () => void;
}

export function useIncidentAnalysis(): UseIncidentAnalysisResult {
  const [state, dispatch] = useReducer(incidentAnalysisReducer, INITIAL_INCIDENT_ANALYSIS_STATE);
  // `dispatch` es estable: la sesión se crea una sola vez por montaje del componente.
  const [session] = useState(() => createIncidentAnalysisSession(dispatch));

  useEffect(() => {
    session.activate();
    return () => session.dispose();
  }, [session]);

  const { file } = state;
  const selectFile = useCallback((next: File | null) => session.selectFile(next), [session]);
  const analyze = useCallback(() => void session.analyze(file), [session, file]);
  const exportResults = useCallback(() => void session.exportResults(), [session]);
  const clearErrors = useCallback(() => session.clearErrors(), [session]);

  return {
    file,
    result: state.result,
    analysis: state.analysis,
    exporting: state.exporting,
    analysisError: state.analysis.status === 'error' ? state.analysis.error : null,
    exportError: state.exporting.status === 'error' ? state.exporting.error : null,
    selectFile,
    analyze,
    exportResults,
    clearErrors,
  };
}
