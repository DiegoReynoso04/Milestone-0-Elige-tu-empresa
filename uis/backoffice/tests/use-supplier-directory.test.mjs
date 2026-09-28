// Estado de /suppliers: reducer y sesión (hooks/use-supplier-directory.ts), sin
// montar React. La unión con React se valida con tsc/lint/build y en el navegador.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  INITIAL_SUPPLIER_DIRECTORY_STATE,
  createSupplierDirectorySession,
  supplierDirectoryReducer,
} from '../hooks/use-supplier-directory.ts';
import { ApiAbortError } from '../lib/api-client.ts';
import { SupplierServiceError } from '../services/suppliers.service.ts';
import { formValues, supplier } from './support/supplier-fakes.mjs';

const tick = () => new Promise((resolve) => setImmediate(resolve));

/** Operación asíncrona controlada a mano; rechaza con ApiAbortError al abortarse. */
function controllable() {
  const calls = [];
  const fn = (...args) => {
    const options = args[args.length - 1];
    return new Promise((resolve, reject) => {
      const call = { args, resolve, reject, aborted: false };
      options.signal.addEventListener('abort', () => {
        call.aborted = true;
        reject(new ApiAbortError());
      });
      calls.push(call);
    });
  };
  return { fn, calls };
}

function harness() {
  const list = controllable();
  const create = controllable();
  const rate = controllable();
  const status = controllable();
  const actions = [];
  let state = INITIAL_SUPPLIER_DIRECTORY_STATE;
  const dispatch = (action) => {
    actions.push(action);
    state = supplierDirectoryReducer(state, action);
  };
  const session = createSupplierDirectorySession(dispatch, {
    listSuppliers: list.fn,
    createSupplier: create.fn,
    updateSupplierRate: rate.fn,
    updateSupplierStatus: status.fn,
  });
  return { session, list, create, rate, status, actions, state: () => state };
}

const SPAIN = { country: 'Spain', category: null };

describe('listado y filtros', () => {
  test('al activarse carga todos los proveedores', async () => {
    const h = harness();
    h.session.activate();
    assert.equal(h.state().list.status, 'loading');
    assert.deepEqual(h.list.calls[0].args[0], { country: null, category: null });
    h.list.calls[0].resolve([supplier()]);
    await tick();
    assert.equal(h.state().list.status, 'success');
    assert.equal(h.state().loaded, true);
    assert.equal(h.state().suppliers.length, 1);
  });

  test('cambiar el filtro pide el listado filtrado y descarta la carga anterior', async () => {
    const h = harness();
    h.session.activate();
    h.session.setFilters(SPAIN);
    assert.equal(h.list.calls[0].aborted, true);
    assert.deepEqual(h.list.calls[1].args[0], SPAIN);
    assert.deepEqual(h.state().filters, SPAIN);
    h.list.calls[1].resolve([supplier({ id: 2 })]);
    await tick();
    assert.deepEqual(h.state().suppliers.map((item) => item.id), [2]);
    assert.equal(h.actions.some((action) => action.type === 'list_failed'), false);
  });

  test('un fallo conserva el último listado', async () => {
    const h = harness();
    h.session.activate();
    h.list.calls[0].resolve([supplier()]);
    await tick();
    h.session.reload();
    h.list.calls[1].reject(new SupplierServiceError({ kind: 'network' }));
    await tick();
    assert.deepEqual(h.state().list, { status: 'error', error: { kind: 'network' } });
    assert.equal(h.state().suppliers.length, 1);
  });
});

describe('cambios por fila', () => {
  async function loaded() {
    const h = harness();
    h.session.activate();
    h.list.calls[0].resolve([supplier({ id: 1 }), supplier({ id: 2, name: 'Other' })]);
    await tick();
    return h;
  }

  test('la nueva tarifa (con su updated_at) se refleja al momento', async () => {
    const h = await loaded();
    h.session.updateRate(1, '349');
    assert.deepEqual(h.state().rows[1], { status: 'saving', action: 'rate' });
    assert.deepEqual(h.rate.calls[0].args.slice(0, 2), [1, '349']);
    h.rate.calls[0].resolve(supplier({ id: 1, monthly_rate: 349, updated_at: '2026-09-29T10:00:00Z' }));
    await tick();
    const row = h.state().suppliers.find((item) => item.id === 1);
    assert.equal(row.monthly_rate, 349);
    assert.equal(row.updated_at, '2026-09-29T10:00:00Z');
    assert.equal(h.state().rows[1], undefined);
  });

  test('cambio de estado y error por fila', async () => {
    const h = await loaded();
    h.session.updateStatus(2, 'suspended');
    h.status.calls[0].resolve(supplier({ id: 2, name: 'Other', status: 'suspended' }));
    await tick();
    assert.equal(h.state().suppliers[1].status, 'suspended');

    h.session.updateStatus(1, 'suspended');
    h.status.calls[1].reject(new SupplierServiceError({ kind: 'not_found' }));
    await tick();
    assert.deepEqual(h.state().rows[1], { status: 'error', action: 'status', error: { kind: 'not_found' } });
    assert.equal(h.state().suppliers[0].status, 'active');
    h.session.clearRow(1);
    assert.equal(h.state().rows[1], undefined);
  });

  test('una sola operación a la vez por proveedor', async () => {
    const h = await loaded();
    h.session.updateRate(1, '10');
    h.session.updateStatus(1, 'suspended');
    assert.equal(h.status.calls.length, 0);
    h.session.updateStatus(2, 'suspended');
    assert.equal(h.status.calls.length, 1);
  });

  test('si una tarifa cambia durante una carga, esa carga se repite (no se muestran datos viejos)', async () => {
    const h = await loaded();
    h.session.reload();
    h.session.updateRate(1, '349');
    h.rate.calls[0].resolve(supplier({ id: 1, monthly_rate: 349 }));
    await tick();
    h.list.calls[1].resolve([supplier({ id: 1, monthly_rate: 100 })]); // obsoleta
    await tick();
    assert.equal(h.list.calls.length, 3);
    assert.equal(h.state().suppliers.find((item) => item.id === 1).monthly_rate, 349);
    h.list.calls[2].resolve([supplier({ id: 1, monthly_rate: 349 })]);
    await tick();
    assert.equal(h.state().list.status, 'success');
    assert.equal(h.state().suppliers[0].monthly_rate, 349);
  });
});

describe('alta', () => {
  test('alta correcta: estado de éxito y recarga con los filtros activos', async () => {
    const h = harness();
    h.session.activate();
    h.session.setFilters(SPAIN);
    h.list.calls[1].resolve([]);
    await tick();
    h.session.create(formValues());
    assert.equal(h.state().create.status, 'submitting');
    h.create.calls[0].resolve(supplier({ id: 16 }));
    await tick();
    assert.equal(h.state().create.status, 'success');
    assert.equal(h.state().create.supplier.id, 16);
    assert.deepEqual(h.list.calls[2].args[0], SPAIN);
  });

  test('el 422 de la API queda en el estado para mostrarlo', async () => {
    const h = harness();
    h.session.activate();
    const error = { kind: 'validation', source: 'api', errors: [{ field: 'monthly_rate', message: 'x' }] };
    h.session.create(formValues());
    h.create.calls[0].reject(new SupplierServiceError(error));
    await tick();
    assert.deepEqual(h.state().create, { status: 'error', error });
    h.session.resetCreate();
    assert.deepEqual(h.state().create, { status: 'idle' });
  });

  test('errores no previstos no filtran su texto', async () => {
    const h = harness();
    h.session.activate();
    h.session.create(formValues());
    h.create.calls[0].reject(new Error('secret detail'));
    await tick();
    assert.deepEqual(h.state().create, { status: 'error', error: { kind: 'unexpected_response' } });
  });
});

describe('desmontaje', () => {
  test('aborta todo y no despacha nada más', async () => {
    const h = harness();
    h.session.activate();
    h.list.calls[0].resolve([supplier()]);
    await tick();
    h.session.reload();
    h.session.updateRate(1, '5');
    h.session.create(formValues());
    const before = h.actions.length;
    h.session.dispose();
    assert.equal(h.list.calls[1].aborted, true);
    assert.equal(h.rate.calls[0].aborted, true);
    assert.equal(h.create.calls[0].aborted, true);
    await tick();
    h.session.setFilters(SPAIN);
    assert.equal(h.actions.length, before);
  });

  test('StrictMode: activar, desmontar y reactivar deja una sola carga vigente', async () => {
    const h = harness();
    h.session.activate();
    h.session.dispose();
    h.session.activate();
    assert.equal(h.list.calls[0].aborted, true);
    h.list.calls[1].resolve([supplier()]);
    await tick();
    assert.equal(h.state().list.status, 'success');
  });
});
