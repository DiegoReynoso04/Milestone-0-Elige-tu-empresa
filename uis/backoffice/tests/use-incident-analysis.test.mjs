// Tests del estado de /incidents: reducer y sesión (cancelación, carreras,
// exportación) de hooks/use-incident-analysis.ts, sin montar React (no hay
// renderizador de tests en el repo y no se añaden dependencias). La unión con
// React (`useIncidentAnalysis`: useReducer + useEffect) se valida manualmente.
// Ejecutar desde uis/backoffice:
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/support/resolve-alias.mjs --test --test-timeout=10000 "tests/*.test.mjs"

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  INITIAL_INCIDENT_ANALYSIS_STATE,
  createIncidentAnalysisSession,
  incidentAnalysisReducer,
} from '../hooks/use-incident-analysis.ts';
import { ApiAbortError } from '../lib/api-client.ts';
import { IncidentServiceError } from '../services/incidents.service.ts';
import { LEAK, csvFile, validAnalysis } from './support/http-fakes.mjs';

const tick = () => new Promise((resolve) => setImmediate(resolve));
const CSV_TEXT = `metric,value\r\ntotal_records,13\r\nnote,${LEAK}\r\n`;

/**
 * Operación asíncrona controlada a mano. Como el servicio real, rechaza con
 * ApiAbortError al abortarse su señal, salvo que se pida ignorar el abort
 * (para simular una respuesta que llega tarde de todas formas).
 */
function controllable() {
  const calls = [];
  const fn = (argument, options) =>
    new Promise((resolve, reject) => {
      const call = { argument, options, resolve, reject, aborted: false, ignoreAbort: false };
      options.signal.addEventListener('abort', () => {
        call.aborted = true;
        if (!call.ignoreAbort) reject(new ApiAbortError());
      });
      calls.push(call);
    });
  return { fn, calls };
}

function harness() {
  const analyze = controllable();
  const exporter = controllable();
  const downloads = [];
  const actions = [];
  let state = INITIAL_INCIDENT_ANALYSIS_STATE;
  const dispatch = (action) => {
    actions.push(action);
    state = incidentAnalysisReducer(state, action);
  };
  const session = createIncidentAnalysisSession(dispatch, {
    analyzeIncidentFile: analyze.fn,
    exportIncidentResults: exporter.fn,
    downloadFile: (blob, filename) => downloads.push({ blob, filename }),
  });
  session.activate();
  return { session, analyze, exporter, downloads, actions, get state() { return state; } };
}

function exported(analysisId, filename = 'results.csv') {
  return { blob: new Blob([CSV_TEXT], { type: 'text/csv' }), analysisId, filename };
}

/** Analiza `file` y resuelve con un resultado de id `id`. */
async function analyzeOk(h, id, file = csvFile()) {
  h.session.selectFile(file);
  const pending = h.session.analyze(file);
  h.analyze.calls.at(-1).resolve(validAnalysis(id));
  await pending;
}

describe('estado inicial y reducer', () => {
  test('estado inicial vacío', () => {
    assert.deepEqual(INITIAL_INCIDENT_ANALYSIS_STATE, {
      file: null,
      result: null,
      analysis: { status: 'idle' },
      exporting: { status: 'idle' },
    });
  });

  test('elegir archivo descarta el error de análisis pero no el resultado', async () => {
    const h = harness();
    await analyzeOk(h, 'A');
    const failing = h.session.analyze(csvFile());
    h.analyze.calls.at(-1).reject(new IncidentServiceError({ kind: 'server_error' }));
    await failing;
    assert.equal(h.state.analysis.status, 'error');
    const next = csvFile('next.csv');
    h.session.selectFile(next);
    assert.equal(h.state.file, next);
    assert.deepEqual(h.state.analysis, { status: 'idle' });
    assert.equal(h.state.result.analysis_id, 'A');
  });

  test('clearErrors limpia ambos errores y conserva el resultado', async () => {
    const h = harness();
    await analyzeOk(h, 'A');
    const failing = h.session.exportResults();
    h.exporter.calls.at(-1).reject(new IncidentServiceError({ kind: 'network' }));
    await failing;
    h.session.clearErrors();
    assert.deepEqual(h.state.exporting, { status: 'idle' });
    assert.equal(h.state.result.analysis_id, 'A');
  });
});

describe('análisis', () => {
  test('éxito: pasa el File tal cual, sin leerlo, y guarda solo el AnalysisResult', async () => {
    const h = harness();
    const file = csvFile('incidents.csv');
    h.session.selectFile(file);
    const pending = h.session.analyze(file);
    assert.deepEqual(h.state.analysis, { status: 'loading' });
    assert.equal(h.analyze.calls[0].argument, file);
    assert.ok(h.analyze.calls[0].options.signal instanceof AbortSignal);
    h.analyze.calls[0].resolve(validAnalysis('A'));
    await pending;
    assert.deepEqual(h.state.analysis, { status: 'success' });
    assert.deepEqual(h.state.result, validAnalysis('A'));
    assert.equal(file.readAttempts, 0);
  });

  test('sin archivo: error controlado y sin llamar a la API', async () => {
    const h = harness();
    await h.session.analyze(null);
    assert.equal(h.analyze.calls.length, 0);
    assert.deepEqual(h.state.analysis, { status: 'error', error: { kind: 'request_invalid' } });
  });

  test('A correcto y B falla: A sigue visible y solo se guarda el UiError', async () => {
    const h = harness();
    await analyzeOk(h, 'A');
    const failing = h.session.analyze(csvFile());
    h.analyze.calls.at(-1).reject(new IncidentServiceError({ kind: 'invalid_csv', detail: 'missing required columns: status' }));
    await failing;
    assert.equal(h.state.result.analysis_id, 'A');
    assert.deepEqual(h.state.analysis, { status: 'error', error: { kind: 'invalid_csv', detail: 'missing required columns: status' } });
  });

  test('un error que no es del servicio se muestra como unexpected_response, sin su texto', async () => {
    const h = harness();
    const failing = h.session.analyze(csvFile());
    h.analyze.calls[0].reject(new Error(`boom ${LEAK}`));
    await failing;
    assert.deepEqual(h.state.analysis, { status: 'error', error: { kind: 'unexpected_response' } });
  });

  test('una nueva ejecución limpia el error anterior', async () => {
    const h = harness();
    const failing = h.session.analyze(csvFile());
    h.analyze.calls[0].reject(new IncidentServiceError({ kind: 'network' }));
    await failing;
    const retry = h.session.analyze(csvFile());
    assert.deepEqual(h.state.analysis, { status: 'loading' });
    h.analyze.calls[1].resolve(validAnalysis('B'));
    await retry;
    assert.deepEqual(h.state.analysis, { status: 'success' });
  });

  test('A → B: B aborta A y la cancelación no se muestra como error', async () => {
    const h = harness();
    const first = h.session.analyze(csvFile());
    const second = h.session.analyze(csvFile());
    assert.equal(h.analyze.calls[0].aborted, true);
    await first;
    assert.deepEqual(h.state.analysis, { status: 'loading' });
    h.analyze.calls[1].resolve(validAnalysis('B'));
    await second;
    assert.equal(h.state.result.analysis_id, 'B');
    assert.equal(h.actions.some((action) => action.type === 'analysis_failed'), false);
  });

  test('una respuesta tardía de A no sobrescribe B', async () => {
    const h = harness();
    const first = h.session.analyze(csvFile());
    h.analyze.calls[0].ignoreAbort = true;
    const second = h.session.analyze(csvFile());
    h.analyze.calls[1].resolve(validAnalysis('B'));
    await second;
    h.analyze.calls[0].resolve(validAnalysis('A'));
    await first;
    assert.equal(h.state.result.analysis_id, 'B');
    assert.deepEqual(h.state.analysis, { status: 'success' });
  });

  test('un fallo tardío de A no se muestra tras el éxito de B', async () => {
    const h = harness();
    const first = h.session.analyze(csvFile());
    h.analyze.calls[0].ignoreAbort = true;
    const second = h.session.analyze(csvFile());
    h.analyze.calls[1].resolve(validAnalysis('B'));
    await second;
    h.analyze.calls[0].reject(new IncidentServiceError({ kind: 'server_error' }));
    await first;
    assert.deepEqual(h.state.analysis, { status: 'success' });
  });

  test('desmontaje: aborta la petición y no despacha nada más', async () => {
    const h = harness();
    const pending = h.session.analyze(csvFile());
    h.analyze.calls[0].ignoreAbort = true;
    const actionsBefore = h.actions.length;
    h.session.dispose();
    assert.equal(h.analyze.calls[0].aborted, true);
    h.analyze.calls[0].resolve(validAnalysis('A'));
    await pending;
    assert.equal(h.actions.length, actionsBefore);
    assert.equal(h.state.result, null);
  });

  test('tras desmontar, ninguna acción despacha ni llama a la API', async () => {
    const h = harness();
    h.session.dispose();
    h.session.selectFile(csvFile());
    h.session.clearErrors();
    await h.session.analyze(null);
    await h.session.analyze(csvFile());
    await h.session.exportResults();
    assert.equal(h.actions.length, 0);
    assert.equal(h.analyze.calls.length, 0);
    assert.equal(h.exporter.calls.length, 0);
  });

  test('desmontaje y remontaje (StrictMode): la sesión vuelve a funcionar', async () => {
    const h = harness();
    h.session.dispose();
    h.session.activate();
    await analyzeOk(h, 'A');
    assert.equal(h.state.result.analysis_id, 'A');
  });
});

describe('exportación', () => {
  test('sin resultado: error no_analysis y sin llamar a la API', async () => {
    const h = harness();
    await h.session.exportResults();
    assert.equal(h.exporter.calls.length, 0);
    assert.deepEqual(h.state.exporting, { status: 'error', error: { kind: 'no_analysis' } });
  });

  test('éxito: usa el analysis_id mostrado, descarga con el nombre seguro y no guarda el Blob', async () => {
    const h = harness();
    await analyzeOk(h, 'A');
    const pending = h.session.exportResults();
    assert.equal(h.exporter.calls[0].argument, 'A');
    assert.deepEqual(h.state.exporting, { status: 'loading' });
    assert.equal(h.state.result.analysis_id, 'A');
    const payload = exported('A', 'results.csv');
    h.exporter.calls[0].resolve(payload);
    await pending;
    assert.deepEqual(h.downloads, [{ blob: payload.blob, filename: 'results.csv' }]);
    assert.deepEqual(h.state.exporting, { status: 'success' });
    assert.equal(h.state.result.analysis_id, 'A');
  });

  test('el estado nunca contiene Blobs exportados, CSV, respuestas ni errores crudos', async () => {
    const h = harness();
    const file = csvFile();
    await analyzeOk(h, 'A', file);
    const pending = h.session.exportResults();
    h.exporter.calls[0].resolve(exported('A'));
    await pending;
    assert.deepEqual(Object.keys(h.state).sort(), ['analysis', 'exporting', 'file', 'result']);
    const seen = [];
    const walk = (value) => {
      if (value === file) return;
      if (value instanceof Blob) seen.push('blob');
      // `export.format` vale "metric,value" por contrato: se buscan líneas del cuerpo CSV.
      else if (typeof value === 'string' && (value.includes('total_records,13') || value.includes(LEAK))) seen.push(value);
      else if (value && typeof value === 'object') Object.values(value).forEach(walk);
    };
    walk(h.state);
    assert.deepEqual(seen, []);
    for (const action of h.actions) walk(action);
    assert.deepEqual(seen, []);
  });

  test('error de exportación conserva el resultado', async () => {
    const h = harness();
    await analyzeOk(h, 'A');
    const pending = h.session.exportResults();
    h.exporter.calls[0].reject(new IncidentServiceError({ kind: 'export_mismatch' }));
    await pending;
    assert.deepEqual(h.state.exporting, { status: 'error', error: { kind: 'export_mismatch' } });
    assert.equal(h.state.result.analysis_id, 'A');
    assert.deepEqual(h.state.analysis, { status: 'success' });
    assert.equal(h.downloads.length, 0);
  });

  test('export de A mientras B se analiza y B tiene éxito: se aborta y nunca descarga', async () => {
    const h = harness();
    await analyzeOk(h, 'A');
    const exporting = h.session.exportResults();
    h.exporter.calls[0].ignoreAbort = true;
    const analyzing = h.session.analyze(csvFile());
    h.analyze.calls.at(-1).resolve(validAnalysis('B'));
    await analyzing;
    assert.equal(h.exporter.calls[0].aborted, true);
    assert.deepEqual(h.state.exporting, { status: 'idle' });
    h.exporter.calls[0].resolve(exported('A'));
    await exporting;
    assert.equal(h.downloads.length, 0);
    assert.equal(h.state.result.analysis_id, 'B');
    assert.deepEqual(h.state.exporting, { status: 'idle' });
  });

  test('export de A mientras B se analiza y B falla: A sigue visible y se descarga', async () => {
    const h = harness();
    await analyzeOk(h, 'A');
    const exporting = h.session.exportResults();
    const analyzing = h.session.analyze(csvFile());
    h.analyze.calls.at(-1).reject(new IncidentServiceError({ kind: 'invalid_csv', detail: 'x' }));
    await analyzing;
    h.exporter.calls[0].resolve(exported('A'));
    await exporting;
    assert.equal(h.downloads.length, 1);
    assert.deepEqual(h.state.exporting, { status: 'success' });
    assert.equal(h.state.result.analysis_id, 'A');
  });

  test('si el servicio devolviera otro analysis_id, no se descarga (resultado obsoleto)', async () => {
    const h = harness();
    await analyzeOk(h, 'A');
    const pending = h.session.exportResults();
    h.exporter.calls[0].resolve(exported('OTHER'));
    await pending;
    assert.equal(h.downloads.length, 0);
    assert.deepEqual(h.state.exporting, { status: 'idle' });
  });

  test('una segunda exportación invalida la primera', async () => {
    const h = harness();
    await analyzeOk(h, 'A');
    const first = h.session.exportResults();
    h.exporter.calls[0].ignoreAbort = true;
    const second = h.session.exportResults();
    h.exporter.calls[1].resolve(exported('A'));
    await second;
    h.exporter.calls[0].resolve(exported('A'));
    await first;
    assert.equal(h.downloads.length, 1);
  });

  test('desmontaje durante la exportación: no descarga ni despacha', async () => {
    const h = harness();
    await analyzeOk(h, 'A');
    const pending = h.session.exportResults();
    h.exporter.calls[0].ignoreAbort = true;
    const actionsBefore = h.actions.length;
    h.session.dispose();
    h.exporter.calls[0].resolve(exported('A'));
    await pending;
    await tick();
    assert.equal(h.downloads.length, 0);
    assert.equal(h.actions.length, actionsBefore);
  });
});
