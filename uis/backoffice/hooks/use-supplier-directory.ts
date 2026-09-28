// Estado de la vista /suppliers: listado filtrado, alta, cambio de tarifa y de
// estado. Solo consume services/suppliers.service.ts (nunca HTTP directo).
//
// Tres piezas, igual que hooks/use-incident-analysis.ts:
//   1. `supplierDirectoryReducer`: transiciones de estado puras.
//   2. `createSupplierDirectorySession`: operaciones asíncronas, cancelación y
//      carreras. Sin React, para poder probarla con `node --test`.
//   3. `useSupplierDirectory`: une ambas con hooks nativos de React.
//
// Carreras:
//   - Listado: cada carga nueva (cambio de filtro, alta) aborta la anterior;
//     una respuesta que ya no es la última se descarta.
//   - Si una tarifa o un estado cambian mientras se carga el listado, la
//     respuesta de esa carga puede ser anterior al cambio: se vuelve a cargar
//     en lugar de mostrar datos viejos.
//   - Cambios por fila: una operación a la vez por proveedor (la UI deshabilita
//     los controles). La respuesta de la API reemplaza la fila al momento.
//   - La cancelación (`ApiAbortError`) no es un error para el usuario.
//   - Tras desmontar no se despacha nada y se abortan las peticiones activas.

import { useCallback, useEffect, useReducer, useState } from 'react';

import { ApiAbortError } from '@/lib/api-client';
import {
  SupplierServiceError,
  createSupplier,
  listSuppliers,
  updateSupplierRate,
  updateSupplierStatus,
} from '@/services/suppliers.service';
import type {
  Supplier,
  SupplierFilters,
  SupplierFormValues,
  SupplierStatus,
  SupplierUiError,
} from '@/types/suppliers';

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

export type ListState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success' }
  | { status: 'error'; error: SupplierUiError };

export type CreateState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; supplier: Supplier }
  | { status: 'error'; error: SupplierUiError };

export type RowAction = 'rate' | 'status';

export type RowState =
  | { status: 'saving'; action: RowAction }
  | { status: 'error'; action: RowAction; error: SupplierUiError };

export interface SupplierDirectoryState {
  filters: SupplierFilters;
  /** Último listado recibido (o actualizado por fila). Un fallo posterior no lo borra. */
  suppliers: readonly Supplier[];
  /** Si ya se recibió algún listado (distingue "vacío" de "aún no cargado"). */
  loaded: boolean;
  list: ListState;
  create: CreateState;
  rows: Readonly<Record<number, RowState>>;
}

export type SupplierDirectoryAction =
  | { type: 'filters_changed'; filters: SupplierFilters }
  | { type: 'list_started' }
  | { type: 'list_succeeded'; suppliers: readonly Supplier[] }
  | { type: 'list_failed'; error: SupplierUiError }
  | { type: 'create_started' }
  | { type: 'create_succeeded'; supplier: Supplier }
  | { type: 'create_failed'; error: SupplierUiError }
  | { type: 'create_reset' }
  | { type: 'row_started'; id: number; action: RowAction }
  | { type: 'row_succeeded'; supplier: Supplier }
  | { type: 'row_failed'; id: number; action: RowAction; error: SupplierUiError }
  | { type: 'row_cleared'; id: number };

export const NO_FILTERS: SupplierFilters = { country: null, category: null };

export const INITIAL_SUPPLIER_DIRECTORY_STATE: SupplierDirectoryState = {
  filters: NO_FILTERS,
  suppliers: [],
  loaded: false,
  list: { status: 'idle' },
  create: { status: 'idle' },
  rows: {},
};

function withoutRow(rows: Readonly<Record<number, RowState>>, id: number): Record<number, RowState> {
  const next = { ...rows };
  delete next[id];
  return next;
}

export function supplierDirectoryReducer(
  state: SupplierDirectoryState,
  action: SupplierDirectoryAction
): SupplierDirectoryState {
  switch (action.type) {
    case 'filters_changed':
      return { ...state, filters: action.filters };
    case 'list_started':
      return { ...state, list: { status: 'loading' } };
    case 'list_succeeded':
      return { ...state, suppliers: action.suppliers, loaded: true, list: { status: 'success' } };
    case 'list_failed':
      return { ...state, list: { status: 'error', error: action.error } };
    case 'create_started':
      return { ...state, create: { status: 'submitting' } };
    case 'create_succeeded':
      return { ...state, create: { status: 'success', supplier: action.supplier } };
    case 'create_failed':
      return { ...state, create: { status: 'error', error: action.error } };
    case 'create_reset':
      return { ...state, create: { status: 'idle' } };
    case 'row_started':
      return { ...state, rows: { ...state.rows, [action.id]: { status: 'saving', action: action.action } } };
    case 'row_succeeded':
      return {
        ...state,
        suppliers: state.suppliers.map((supplier) => (supplier.id === action.supplier.id ? action.supplier : supplier)),
        rows: withoutRow(state.rows, action.supplier.id),
      };
    case 'row_failed':
      return {
        ...state,
        rows: { ...state.rows, [action.id]: { status: 'error', action: action.action, error: action.error } },
      };
    case 'row_cleared':
      return { ...state, rows: withoutRow(state.rows, action.id) };
  }
}

// ---------------------------------------------------------------------------
// Sesión: operaciones asíncronas, cancelación y carreras
// ---------------------------------------------------------------------------

export interface SupplierDirectoryDependencies {
  listSuppliers: typeof listSuppliers;
  createSupplier: typeof createSupplier;
  updateSupplierRate: typeof updateSupplierRate;
  updateSupplierStatus: typeof updateSupplierStatus;
}

export interface SupplierDirectorySession {
  /** Habilita el despacho y carga el listado (montaje). Compatible con StrictMode. */
  activate(): void;
  /** Desmontaje: aborta todo y deja de despachar. */
  dispose(): void;
  setFilters(filters: SupplierFilters): void;
  reload(): Promise<void>;
  create(values: SupplierFormValues): Promise<void>;
  resetCreate(): void;
  updateRate(id: number, rateInput: string): Promise<void>;
  updateStatus(id: number, status: SupplierStatus): Promise<void>;
  clearRow(id: number): void;
}

const DEFAULT_DEPENDENCIES: SupplierDirectoryDependencies = {
  listSuppliers,
  createSupplier,
  updateSupplierRate,
  updateSupplierStatus,
};

/** Error del servicio → SupplierUiError; cualquier otro fallo, sin reenviar su texto. */
const FALLBACK_ERROR: SupplierUiError = { kind: 'unexpected_response' };

export function createSupplierDirectorySession(
  dispatch: (action: SupplierDirectoryAction) => void,
  dependencies: SupplierDirectoryDependencies = DEFAULT_DEPENDENCIES,
  initialFilters: SupplierFilters = NO_FILTERS
): SupplierDirectorySession {
  let active = false;
  let filters = initialFilters;

  let listRun = 0;
  let listController: AbortController | null = null;
  let createRun = 0;
  let createController: AbortController | null = null;
  const rowControllers = new Map<number, AbortController>();
  // Cambios confirmados por la API (altas y cambios por fila). Si cambia durante
  // una carga del listado, esa carga puede traer datos anteriores al cambio.
  let mutations = 0;

  function emit(action: SupplierDirectoryAction): void {
    if (active) dispatch(action);
  }

  function invalidateList(): void {
    listRun += 1;
    listController?.abort();
    listController = null;
  }

  async function load(): Promise<void> {
    if (!active) return;
    invalidateList();
    const run = listRun;
    const controller = new AbortController();
    listController = controller;
    const mutationsAtStart = mutations;
    emit({ type: 'list_started' });

    try {
      const suppliers = await dependencies.listSuppliers(filters, { signal: controller.signal });
      if (!active || run !== listRun) return;
      if (mutations !== mutationsAtStart) {
        // Llegó un cambio mientras se cargaba: esta respuesta puede estar obsoleta.
        void load();
        return;
      }
      emit({ type: 'list_succeeded', suppliers });
    } catch (error) {
      if (!active || run !== listRun || error instanceof ApiAbortError) return;
      emit({ type: 'list_failed', error: error instanceof SupplierServiceError ? error.uiError : FALLBACK_ERROR });
    } finally {
      if (listController === controller) listController = null;
    }
  }

  async function updateRow(
    id: number,
    action: RowAction,
    request: (signal: AbortSignal) => Promise<Supplier>
  ): Promise<void> {
    if (!active || rowControllers.has(id)) return;
    const controller = new AbortController();
    rowControllers.set(id, controller);
    emit({ type: 'row_started', id, action });

    try {
      const supplier = await request(controller.signal);
      if (!active || rowControllers.get(id) !== controller) return;
      mutations += 1;
      emit({ type: 'row_succeeded', supplier });
    } catch (error) {
      if (!active || rowControllers.get(id) !== controller || error instanceof ApiAbortError) return;
      emit({ type: 'row_failed', id, action, error: error instanceof SupplierServiceError ? error.uiError : FALLBACK_ERROR });
    } finally {
      if (rowControllers.get(id) === controller) rowControllers.delete(id);
    }
  }

  return {
    activate() {
      if (active) return;
      active = true;
      void load();
    },

    dispose() {
      active = false;
      invalidateList();
      createRun += 1;
      createController?.abort();
      createController = null;
      for (const controller of rowControllers.values()) controller.abort();
      rowControllers.clear();
    },

    setFilters(next) {
      if (!active) return;
      filters = next;
      emit({ type: 'filters_changed', filters: next });
      void load();
    },

    reload: load,

    async create(values) {
      if (!active) return;
      createRun += 1;
      createController?.abort();
      const run = createRun;
      const controller = new AbortController();
      createController = controller;
      emit({ type: 'create_started' });

      try {
        const supplier = await dependencies.createSupplier(values, { signal: controller.signal });
        if (!active || run !== createRun) return;
        mutations += 1;
        emit({ type: 'create_succeeded', supplier });
        // El proveedor nuevo puede no cumplir los filtros activos: manda la API.
        void load();
      } catch (error) {
        if (!active || run !== createRun || error instanceof ApiAbortError) return;
        emit({ type: 'create_failed', error: error instanceof SupplierServiceError ? error.uiError : FALLBACK_ERROR });
      } finally {
        if (createController === controller) createController = null;
      }
    },

    resetCreate() {
      emit({ type: 'create_reset' });
    },

    updateRate(id, rateInput) {
      return updateRow(id, 'rate', (signal) => dependencies.updateSupplierRate(id, rateInput, { signal }));
    },

    updateStatus(id, status) {
      return updateRow(id, 'status', (signal) => dependencies.updateSupplierStatus(id, status, { signal }));
    },

    clearRow(id) {
      if (!rowControllers.has(id)) emit({ type: 'row_cleared', id });
    },
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseSupplierDirectoryResult extends SupplierDirectoryState {
  setFilters: (filters: SupplierFilters) => void;
  reload: () => void;
  submitSupplier: (values: SupplierFormValues) => void;
  resetCreate: () => void;
  updateRate: (id: number, rateInput: string) => void;
  updateStatus: (id: number, status: SupplierStatus) => void;
  clearRow: (id: number) => void;
}

export function useSupplierDirectory(): UseSupplierDirectoryResult {
  const [state, dispatch] = useReducer(supplierDirectoryReducer, INITIAL_SUPPLIER_DIRECTORY_STATE);
  // `dispatch` es estable: la sesión se crea una sola vez por montaje del componente.
  const [session] = useState(() => createSupplierDirectorySession(dispatch));

  useEffect(() => {
    session.activate();
    return () => session.dispose();
  }, [session]);

  const setFilters = useCallback((filters: SupplierFilters) => session.setFilters(filters), [session]);
  const reload = useCallback(() => void session.reload(), [session]);
  const submitSupplier = useCallback((values: SupplierFormValues) => void session.create(values), [session]);
  const resetCreate = useCallback(() => session.resetCreate(), [session]);
  const updateRate = useCallback((id: number, rateInput: string) => void session.updateRate(id, rateInput), [session]);
  const updateStatus = useCallback(
    (id: number, status: SupplierStatus) => void session.updateStatus(id, status),
    [session]
  );
  const clearRow = useCallback((id: number) => session.clearRow(id), [session]);

  return { ...state, setFilters, reload, submitSupplier, resetCreate, updateRate, updateStatus, clearRow };
}
