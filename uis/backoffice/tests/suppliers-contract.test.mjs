// El vocabulario del directorio de proveedores del frontend (types/suppliers.ts)
// coincide exactamente con docs/ligthweight-storage-api.md, y la regla de
// "renovación en los próximos 60 días" (lib/supplier-renewal.ts).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { RENEWAL_WINDOW_DAYS, daysUntil, renewalInfo } from '../lib/supplier-renewal.ts';
import {
  SUPPLIER_CATEGORIES,
  SUPPLIER_COUNTRIES,
  SUPPLIER_CURRENCIES,
  SUPPLIER_STATUSES,
} from '../types/suppliers.ts';

const CONTEXT = readFileSync(new URL('../../../docs/ligthweight-storage-api.md', import.meta.url), 'utf8');

/** Strings de la lista Python `NAME = [...]` del CONTEXT. */
function pythonList(name) {
  const match = new RegExp(`${name} = \\[([^\\]]*)\\]`).exec(CONTEXT);
  assert.ok(match, `${name} not found in the CONTEXT`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

describe('vocabulario = CONTEXT', () => {
  test('categorías válidas, en el mismo orden', () => {
    assert.deepEqual([...SUPPLIER_CATEGORIES], pythonList('VALID_CATEGORIES'));
  });

  test('estados válidos', () => {
    assert.deepEqual([...SUPPLIER_STATUSES], pythonList('VALID_STATUSES'));
  });

  test('países y monedas del modelo', () => {
    assert.match(CONTEXT, /`"Spain"` o `"USA"`/);
    assert.match(CONTEXT, /`"EUR"` para Spain, `"USD"` para USA/);
    assert.deepEqual([...SUPPLIER_COUNTRIES], ['Spain', 'USA']);
    assert.deepEqual([...SUPPLIER_CURRENCIES], ['EUR', 'USD']);
  });

  test('la ventana de renovación es de 60 días', () => {
    assert.match(CONTEXT, /próximos 60 días/);
    assert.equal(RENEWAL_WINDOW_DAYS, 60);
  });
});

describe('renovaciones próximas', () => {
  const today = new Date(2026, 8, 29, 23, 30); // 29 sep 2026, hora local tardía

  test('días naturales con la fecha local, sin desfase horario', () => {
    assert.equal(daysUntil('2026-09-29', today), 0);
    assert.equal(daysUntil('2026-09-30', today), 1);
    assert.equal(daysUntil('2026-11-28', today), 60);
    assert.equal(daysUntil('2026-09-28', today), -1);
  });

  test('hoy y hasta el día 60 incluido → destacado', () => {
    assert.deepEqual(renewalInfo('2026-09-29', today), { kind: 'upcoming', daysLeft: 0 });
    assert.deepEqual(renewalInfo('2026-11-28', today), { kind: 'upcoming', daysLeft: 60 });
  });

  test('más allá de 60 días, pasadas o sin fecha → no destacado', () => {
    assert.deepEqual(renewalInfo('2026-11-29', today), { kind: 'later' });
    assert.deepEqual(renewalInfo('2025-03-31', today), { kind: 'past' });
    assert.deepEqual(renewalInfo(null, today), { kind: 'none' });
  });

  test('fechas mal formadas o imposibles no se destacan', () => {
    for (const value of ['2026-02-30', '29/09/2026', '2026-9-30', '']) {
      assert.deepEqual(renewalInfo(value, today), { kind: 'none' }, value);
    }
  });

  test('ningún proveedor del seed está en la ventana en la fecha actual del proyecto', () => {
    const seedDates = [...CONTEXT.matchAll(/"contract_renewal_date": "([^"]+)"/g)].map((item) => item[1]);
    assert.equal(seedDates.length, 10);
    for (const date of seedDates) assert.equal(renewalInfo(date, today).kind, 'past', date);
  });
});
