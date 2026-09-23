// Tests de services/normalizers.ts con el runner nativo de Node (sin dependencias):
//   node --test tests/
// Es .mjs para poder importar el módulo .ts con su extensión (Node ≥ 22.18 ejecuta
// TypeScript borrando los tipos) sin cambiar tsconfig.json. Solo datos ficticios
// (`example.invalid`).

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  UnexpectedResponseError,
  normalizeAnalysisResponse,
  normalizeApiErrorBody,
} from '../services/normalizers.ts';

const LEAK = 'leak.canary@example.invalid';

// Respuesta con la forma de services/api/SPECS.md §3.1 (valores del fixture sintético).
function validResponse() {
  return {
    analysis_id: '7d3e0c2a-5b1f-4a57-9d0e-2f4c1b8a6e10',
    analyzed_at: '2026-09-23T10:15:00Z',
    totals: { total_records: 13, valid_records: 8, invalid_records: 5 },
    invalid_breakdown: [
      { code: 'missing_client_company', label: 'Missing client_company', count: 2 },
      { code: 'invalid_category', label: 'Invalid or missing category', count: 1 },
      { code: 'invalid_description', label: 'Invalid or missing description', count: 1 },
      { code: 'invalid_agent_id', label: 'Invalid or missing agent_id', count: 1 },
      { code: 'invalid_email', label: 'Invalid or missing email', count: 2 },
      { code: 'closed_without_score', label: 'Closed ticket, no score', count: 1 },
      { code: 'score_out_of_range', label: 'Score out of range', count: 1 },
    ],
    categories: [
      { code: 'TECHNICAL', count: 2, percentage: '25.0' },
      { code: 'BILLING', count: 2, percentage: '25.0' },
      { code: 'ACCESS', count: 1, percentage: '12.5' },
      { code: 'HR_QUERY', count: 1, percentage: '12.5' },
      { code: 'COMPLAINT', count: 2, percentage: '25.0' },
    ],
    statuses: [
      { code: 'OPEN', count: 2, percentage: '25.0' },
      { code: 'CLOSED', count: 4, percentage: '50.0' },
      { code: 'DISCARDED', count: 1, percentage: '12.5' },
    ],
    satisfaction: {
      closed_tickets: 4,
      scored_tickets: 4,
      average_score: '3.75',
      distribution: [
        { score: 1, label: 'Very dissatisfied', count: 0 },
        { score: 2, label: 'Dissatisfied', count: 1 },
        { score: 3, label: 'Neutral', count: 0 },
        { score: 4, label: 'Satisfied', count: 2 },
        { score: 5, label: 'Very satisfied', count: 1 },
      ],
    },
    export: {
      available: true,
      url: '/api/incidents/results/export',
      filename: 'results.csv',
      format: 'metric,value',
    },
  };
}

function assertUnexpected(input, pathFragment) {
  assert.throws(
    () => normalizeAnalysisResponse(input),
    (error) => {
      assert.ok(error instanceof UnexpectedResponseError, `expected UnexpectedResponseError, got ${error}`);
      assert.ok(error.path.includes(pathFragment), `path "${error.path}" should include "${pathFragment}"`);
      return true;
    }
  );
}

describe('normalizeAnalysisResponse — respuesta válida', () => {
  test('normaliza una respuesta completa', () => {
    assert.deepEqual(normalizeAnalysisResponse(validResponse()), validResponse());
  });

  test('conserva null en porcentajes y media', () => {
    const input = validResponse();
    for (const item of [...input.categories, ...input.statuses]) item.percentage = null;
    input.satisfaction.average_score = null;
    const result = normalizeAnalysisResponse(input);
    assert.ok(result.categories.every((item) => item.percentage === null));
    assert.ok(result.statuses.every((item) => item.percentage === null));
    assert.equal(result.satisfaction.average_score, null);
  });

  test('conserva los strings numéricos sin convertirlos a number', () => {
    const result = normalizeAnalysisResponse(validResponse());
    assert.equal(result.categories[0].percentage, '25.0');
    assert.equal(typeof result.categories[0].percentage, 'string');
    assert.equal(result.satisfaction.average_score, '3.75');
    assert.equal(typeof result.satisfaction.average_score, 'string');
  });

  test('devuelve objetos nuevos, independientes del input', () => {
    const input = validResponse();
    const result = normalizeAnalysisResponse(input);
    assert.notEqual(result, input);
    assert.notEqual(result.totals, input.totals);
    assert.notEqual(result.categories, input.categories);
    assert.notEqual(result.categories[0], input.categories[0]);
    input.totals.total_records = 999;
    input.categories[0].code = 'CHANGED';
    assert.equal(result.totals.total_records, 13);
    assert.equal(result.categories[0].code, 'TECHNICAL');
  });
});

describe('normalizeAnalysisResponse — estructura inválida', () => {
  test('rechaza null, arrays, primitivos y objeto vacío', () => {
    assertUnexpected(null, 'response');
    assertUnexpected([], 'response');
    assertUnexpected('texto', 'response');
    assertUnexpected(42, 'response');
    assertUnexpected({}, 'response.analysis_id');
  });

  test('rechaza campos obligatorios ausentes', () => {
    for (const key of ['analysis_id', 'analyzed_at', 'totals', 'invalid_breakdown', 'categories', 'statuses', 'satisfaction', 'export']) {
      const input = validResponse();
      delete input[key];
      assertUnexpected(input, `response.${key}`);
    }
    const nested = validResponse();
    delete nested.satisfaction.average_score;
    assertUnexpected(nested, 'response.satisfaction.average_score');
  });

  test('rechaza tipos incorrectos', () => {
    const cases = [
      [(r) => { r.analysis_id = 123; }, 'response.analysis_id'],
      [(r) => { r.totals.total_records = '13'; }, 'response.totals.total_records'],
      [(r) => { r.totals.valid_records = 1.5; }, 'response.totals.valid_records'],
      [(r) => { r.invalid_breakdown[2].count = null; }, 'response.invalid_breakdown[2].count'],
      [(r) => { r.invalid_breakdown[0].label = 7; }, 'response.invalid_breakdown[0].label'],
      [(r) => { r.categories[1].percentage = 25; }, 'response.categories[1].percentage'],
      [(r) => { r.statuses[0].code = null; }, 'response.statuses[0].code'],
      [(r) => { r.satisfaction.average_score = 3.75; }, 'response.satisfaction.average_score'],
      [(r) => { r.satisfaction.distribution[4].score = '5'; }, 'response.satisfaction.distribution[4].score'],
      [(r) => { r.export.available = 'true'; }, 'response.export.available'],
      [(r) => { r.export = []; }, 'response.export'],
      [(r) => { r.categories = {}; }, 'response.categories'],
    ];
    for (const [mutate, path] of cases) {
      const input = validResponse();
      mutate(input);
      assertUnexpected(input, path);
    }
  });

  test('exige exactamente 7 reglas, 5 categorías, 3 estados y 5 puntuaciones', () => {
    const cases = [
      ['invalid_breakdown', (r) => r.invalid_breakdown, 7],
      ['categories', (r) => r.categories, 5],
      ['statuses', (r) => r.statuses, 3],
      ['satisfaction.distribution', (r) => r.satisfaction.distribution, 5],
    ];
    for (const [path, pick, expected] of cases) {
      const fewer = validResponse();
      pick(fewer).pop();
      assertUnexpected(fewer, `response.${path}`);

      const more = validResponse();
      const list = pick(more);
      list.push({ ...list[0] });
      assertUnexpected(more, `response.${path}`);

      assert.equal(pick(validResponse()).length, expected);
    }
  });
});

describe('normalizeAnalysisResponse — privacidad y whitelist', () => {
  test('las propiedades desconocidas no aparecen en el resultado', () => {
    const input = validResponse();
    input.extra_top = 'x';
    input.totals.extra = 1;
    input.categories[0].extra = 'x';
    input.satisfaction.distribution[0].extra = 'x';
    input.export.extra = 'x';
    const result = normalizeAnalysisResponse(input);
    assert.deepEqual(result, validResponse());
    assert.equal(JSON.stringify(result).includes('extra'), false);
  });

  test('un customer_email añadido artificialmente no llega al resultado', () => {
    const input = validResponse();
    input.customer_email = LEAK;
    input.rows = [{ ticket_id: 'NXV-000001', customer_email: LEAK, description: 'Printer broken' }];
    input.invalid_breakdown[0].customer_email = LEAK;
    input.satisfaction.customer_email = LEAK;
    const serialized = JSON.stringify(normalizeAnalysisResponse(input));
    assert.equal(serialized.includes('customer_email'), false);
    assert.equal(serialized.includes(LEAK), false);
    assert.equal(serialized.includes('NXV-000001'), false);
    assert.equal(serialized.includes('Printer broken'), false);
  });

  test('los errores no incluyen valores recibidos ni el objeto completo', () => {
    const cases = [
      (r) => { r.invalid_breakdown[0].count = LEAK; },
      (r) => { r.analysis_id = { customer_email: LEAK }; },
      (r) => { r.categories.push({ code: LEAK, count: 1, percentage: null }); },
      (r) => { r.customer_email = LEAK; r.totals = LEAK; },
    ];
    for (const mutate of cases) {
      const input = validResponse();
      mutate(input);
      assert.throws(
        () => normalizeAnalysisResponse(input),
        (error) => {
          assert.ok(error instanceof UnexpectedResponseError);
          const exposed = [error.message, error.path, JSON.stringify(error), String(error)].join(' ');
          assert.equal(exposed.includes(LEAK), false);
          assert.equal(exposed.includes('customer_email'), false);
          assert.equal(exposed.includes('7d3e0c2a'), false);
          return true;
        }
      );
    }
  });
});

describe('normalizeApiErrorBody', () => {
  test('body válido {detail, code}', () => {
    assert.deepEqual(
      normalizeApiErrorBody({ detail: 'missing required columns: customer_email', code: 'invalid_csv' }),
      { code: 'invalid_csv', detail: 'missing required columns: customer_email' }
    );
  });

  test('body parcial', () => {
    assert.deepEqual(normalizeApiErrorBody({ code: 'no_analysis' }), { code: 'no_analysis', detail: null });
    assert.deepEqual(normalizeApiErrorBody({ detail: 'Not Found' }), { code: null, detail: 'Not Found' });
  });

  test('body con tipos incorrectos', () => {
    assert.deepEqual(normalizeApiErrorBody({ code: 500, detail: true }), { code: null, detail: null });
    // 422 de la API: detail es una lista de {loc, msg, type} y se descarta.
    assert.deepEqual(
      normalizeApiErrorBody({ detail: [{ loc: ['body', 'file'], msg: 'Field required', type: 'missing' }], code: 'validation_error' }),
      { code: 'validation_error', detail: null }
    );
  });

  test('body completamente arbitrario', () => {
    for (const input of [null, undefined, 'Internal Server Error', 42, [], ['x'], { foo: 'bar' }]) {
      assert.deepEqual(normalizeApiErrorBody(input), { code: null, detail: null });
    }
  });

  test('no copia ninguna otra propiedad del body', () => {
    const result = normalizeApiErrorBody({ code: 'invalid_csv', detail: 'x', customer_email: LEAK, rows: [LEAK] });
    assert.deepEqual(Object.keys(result).sort(), ['code', 'detail']);
    assert.equal(JSON.stringify(result).includes(LEAK), false);
  });
});
