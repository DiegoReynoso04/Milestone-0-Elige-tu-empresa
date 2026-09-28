// Directorio de proveedores: normalizadores (services/normalizers.ts) y servicio
// (services/suppliers.service.ts) con el cliente real y un transporte falso.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { ApiAbortError, createApiClient } from '../lib/api-client.ts';
import {
  UnexpectedResponseError,
  normalizeSupplier,
  normalizeSupplierList,
  normalizeValidationErrors,
} from '../services/normalizers.ts';
import {
  SupplierServiceError,
  buildSupplierPayload,
  createSuppliersService,
  parseRate,
  suppliersQuery,
  validateSupplierForm,
} from '../services/suppliers.service.ts';
import { BASE_URL, hangingFetch, jsonResponse, offlineFetch, recordingFetch, textResponse } from './support/http-fakes.mjs';
import { formValues, supplier, validationBody } from './support/supplier-fakes.mjs';

function serviceWith(makeResponse) {
  const transport = recordingFetch(makeResponse);
  const client = createApiClient({ fetch: transport.fetch, getBaseUrl: () => BASE_URL });
  return { service: createSuppliersService({ client, timeoutMs: 1_000 }), transport };
}

function expectUiError(expected) {
  return (error) => {
    assert.ok(error instanceof SupplierServiceError, `expected SupplierServiceError, got ${error?.name}`);
    assert.deepEqual(error.uiError, expected);
    return true;
  };
}

function sentJson(call) {
  return JSON.parse(call.init.body);
}

describe('normalizadores de proveedores', () => {
  test('proveedor válido: whitelist de campos', () => {
    const input = { ...supplier({ contract_renewal_date: '2026-10-15', notes: 'n' }), extra: 'ignored' };
    const { extra, ...expected } = input;
    assert.equal(extra, 'ignored');
    assert.deepEqual(normalizeSupplier(input), expected);
  });

  test('lista de proveedores', () => {
    assert.deepEqual(normalizeSupplierList([supplier(), supplier({ id: 2 })]).map((item) => item.id), [1, 2]);
    assert.deepEqual(normalizeSupplierList([]), []);
    assert.throws(() => normalizeSupplierList({}), UnexpectedResponseError);
  });

  test('valores fuera del vocabulario o tipos incorrectos se rechazan', () => {
    for (const bad of [
      { country: 'France' },
      { currency: 'GBP' },
      { status: 'inactive' },
      { categories: ['catering'] },
      { categories: 'job_boards' },
      { monthly_rate: '100' },
      { id: 1.5 },
      { contract_renewal_date: 20260101 },
    ]) {
      assert.throws(() => normalizeSupplier(supplier(bad)), UnexpectedResponseError, JSON.stringify(bad));
    }
  });

  test('422 → errores por campo, sin el prefijo de Pydantic', () => {
    const body = validationBody(
      [['body', 'monthly_rate'], 'Input should be greater than 0'],
      [['body'], 'Value error, currency must be EUR for suppliers in Spain'],
      [['body', 'categories', 0], "Input should be 'job_boards', 'ats_software'"],
      [['query', 'country'], 'Input should be Spain or USA']
    );
    assert.deepEqual(normalizeValidationErrors(body), [
      { field: 'monthly_rate', message: 'Input should be greater than 0' },
      { field: null, message: 'currency must be EUR for suppliers in Spain' },
      { field: 'categories', message: "Input should be 'job_boards', 'ats_software'" },
      { field: null, message: 'Input should be Spain or USA' },
    ]);
  });

  test('422 mal formado → lista vacía, nunca lanza', () => {
    for (const body of [null, 'x', {}, { detail: 'text' }, { detail: [{ loc: 'x', msg: 1 }] }]) {
      assert.deepEqual(normalizeValidationErrors(body), []);
    }
  });
});

describe('validación en cliente (campos requeridos)', () => {
  test('formulario completo → sin errores', () => {
    assert.deepEqual(validateSupplierForm(formValues()), []);
  });

  test('cada campo requerido vacío produce su error', () => {
    const errors = validateSupplierForm(
      formValues({ name: '  ', country: '', categories: [], monthly_rate: '', currency: '', status: '' })
    );
    assert.deepEqual(
      errors.map((error) => error.field),
      ['name', 'country', 'categories', 'monthly_rate', 'currency', 'status']
    );
  });

  test('la tarifa debe ser un número > 0', () => {
    for (const value of ['0', '-5', 'abc', '1e3', '12.', '']) assert.equal(parseRate(value), null, value);
    assert.equal(parseRate('299'), 299);
    assert.equal(parseRate('299,5'), 299.5);
    assert.equal(parseRate(' 0.01 '), 0.01);
  });

  test('la coherencia país/moneda NO se valida en cliente: la decide la API', () => {
    assert.deepEqual(validateSupplierForm(formValues({ country: 'Spain', currency: 'USD' })), []);
  });
});

describe('body y query', () => {
  test('body de alta: campos del CONTEXT, opcionales vacíos omitidos, sin id ni updated_at', () => {
    assert.deepEqual(buildSupplierPayload(formValues({ name: ' Workable ' }), 299), {
      name: 'Workable',
      country: 'Spain',
      categories: ['job_boards'],
      monthly_rate: 299,
      currency: 'EUR',
      status: 'active',
    });
    const withOptional = buildSupplierPayload(
      formValues({ contract_renewal_date: '2026-10-15', contact_email: 'a@example.invalid', notes: ' nota ' }),
      10
    );
    assert.equal(withOptional.contract_renewal_date, '2026-10-15');
    assert.equal(withOptional.contact_email, 'a@example.invalid');
    assert.equal(withOptional.notes, 'nota');
  });

  test('query solo con los filtros activos', () => {
    assert.equal(suppliersQuery({ country: null, category: null }), '/suppliers');
    assert.equal(suppliersQuery({ country: 'USA', category: null }), '/suppliers?country=USA');
    assert.equal(suppliersQuery({ country: null, category: 'ats_software' }), '/suppliers?category=ats_software');
    assert.equal(
      suppliersQuery({ country: 'Spain', category: 'job_boards' }),
      '/suppliers?country=Spain&category=job_boards'
    );
  });
});

describe('servicio de proveedores', () => {
  test('listSuppliers: GET con filtros y lista normalizada', async () => {
    const { service, transport } = serviceWith(() => jsonResponse(200, [supplier()]));
    const result = await service.listSuppliers({ country: 'Spain', category: 'job_boards' });
    assert.equal(result.length, 1);
    assert.equal(transport.calls[0].url, `${BASE_URL}/suppliers?country=Spain&category=job_boards`);
    assert.equal(transport.calls[0].init.method, 'GET');
  });

  test('createSupplier: POST JSON y 201', async () => {
    const created = supplier({ id: 16 });
    const { service, transport } = serviceWith(() => jsonResponse(201, created));
    assert.deepEqual(await service.createSupplier(formValues()), created);
    const call = transport.calls[0];
    assert.equal(call.url, `${BASE_URL}/suppliers`);
    assert.equal(call.init.method, 'POST');
    assert.equal(call.init.headers['Content-Type'], 'application/json');
    assert.equal(call.init.credentials, undefined);
    assert.deepEqual(sentJson(call), buildSupplierPayload(formValues(), 100));
  });

  test('createSupplier con campos requeridos vacíos: no hace ninguna petición', async () => {
    const { service, transport } = serviceWith(() => jsonResponse(201, supplier()));
    await assert.rejects(service.createSupplier(formValues({ name: '' })), (error) => {
      assert.equal(error.uiError.kind, 'validation');
      assert.equal(error.uiError.source, 'client');
      assert.deepEqual(error.uiError.errors.map((item) => item.field), ['name']);
      return true;
    });
    assert.equal(transport.calls.length, 0);
  });

  test('createSupplier: el 422 de la API se entrega por campo', async () => {
    const { service } = serviceWith(() =>
      jsonResponse(422, validationBody([['body'], 'Value error, currency must be EUR for suppliers in Spain']))
    );
    await assert.rejects(
      service.createSupplier(formValues({ currency: 'USD' })),
      expectUiError({
        kind: 'validation',
        source: 'api',
        errors: [{ field: null, message: 'currency must be EUR for suppliers in Spain' }],
      })
    );
  });

  test('updateSupplierRate: PATCH /{id}/rate con el número', async () => {
    const updated = supplier({ monthly_rate: 349, updated_at: '2026-09-29T10:00:00Z' });
    const { service, transport } = serviceWith(() => jsonResponse(200, updated));
    assert.deepEqual(await service.updateSupplierRate(1, '349'), updated);
    assert.equal(transport.calls[0].url, `${BASE_URL}/suppliers/1/rate`);
    assert.equal(transport.calls[0].init.method, 'PATCH');
    assert.deepEqual(sentJson(transport.calls[0]), { monthly_rate: 349 });
  });

  test('updateSupplierRate: tarifa ≤ 0 o no numérica no llega a la API', async () => {
    const { service, transport } = serviceWith(() => jsonResponse(200, supplier()));
    for (const value of ['0', '-10', 'abc']) {
      await assert.rejects(service.updateSupplierRate(1, value), (error) => error.uiError.kind === 'validation');
    }
    assert.equal(transport.calls.length, 0);
  });

  test('updateSupplierStatus: PATCH /{id}/status', async () => {
    const { service, transport } = serviceWith(() => jsonResponse(200, supplier({ status: 'suspended' })));
    assert.equal((await service.updateSupplierStatus(7, 'suspended')).status, 'suspended');
    assert.equal(transport.calls[0].url, `${BASE_URL}/suppliers/7/status`);
    assert.deepEqual(sentJson(transport.calls[0]), { status: 'suspended' });
  });

  test('traducción de errores HTTP', async () => {
    const cases = [
      [jsonResponse(404, { detail: 'supplier not found', code: 'supplier_not_found' }), { kind: 'not_found' }],
      [jsonResponse(404, { detail: 'Not Found', code: 'not_found' }), { kind: 'request_invalid' }],
      [jsonResponse(422, { detail: [], code: 'validation_error' }), { kind: 'request_invalid' }],
      [textResponse(422, 'oops'), { kind: 'request_invalid' }],
      [jsonResponse(500, { detail: 'internal server error', code: 'internal_error' }), { kind: 'server_error' }],
      [jsonResponse(405, { detail: 'Method Not Allowed', code: 'method_not_allowed' }), { kind: 'request_invalid' }],
      [jsonResponse(200, { unexpected: true }), { kind: 'unexpected_response' }],
    ];
    for (const [response, expected] of cases) {
      const { service } = serviceWith(() => response);
      await assert.rejects(service.updateSupplierStatus(1, 'active'), expectUiError(expected));
    }
  });

  test('una respuesta con otro status de éxito del esperado no se acepta', async () => {
    const { service } = serviceWith(() => jsonResponse(200, supplier()));
    await assert.rejects(service.createSupplier(formValues()), expectUiError({ kind: 'unexpected_response' }));
  });

  test('transporte: sin red, sin configuración, timeout y cancelación', async () => {
    const offline = createSuppliersService({
      client: createApiClient({ fetch: offlineFetch(), getBaseUrl: () => BASE_URL }),
    });
    await assert.rejects(offline.listSuppliers({ country: null, category: null }), expectUiError({ kind: 'network' }));

    const unconfigured = createSuppliersService({ client: createApiClient({ getBaseUrl: () => undefined }) });
    await assert.rejects(unconfigured.listSuppliers({ country: null, category: null }), expectUiError({ kind: 'config' }));

    const slow = createSuppliersService({
      client: createApiClient({ fetch: hangingFetch(), getBaseUrl: () => BASE_URL }),
      timeoutMs: 20,
    });
    await assert.rejects(slow.listSuppliers({ country: null, category: null }), expectUiError({ kind: 'timeout' }));

    const controller = new AbortController();
    const pending = slow.listSuppliers({ country: null, category: null }, { signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, ApiAbortError);
  });
});
