import type { ChangeEvent } from 'react';

import { Button } from '@/components/ui/button';
import {
  SUPPLIER_CATEGORIES,
  SUPPLIER_COUNTRIES,
  type SupplierCategory,
  type SupplierCountry,
  type SupplierFilters,
} from '@/types/suppliers';

export interface SupplierFilterBarProps {
  filters: SupplierFilters;
  onChange: (filters: SupplierFilters) => void;
}

const SELECT_CLASSES =
  'rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

function toCountry(value: string): SupplierCountry | null {
  return SUPPLIER_COUNTRIES.find((country) => country === value) ?? null;
}

function toCategory(value: string): SupplierCategory | null {
  return SUPPLIER_CATEGORIES.find((category) => category === value) ?? null;
}

// Cada cambio pide a la API el listado filtrado (GET /suppliers?country=&category=),
// sin recargar la página.
export function SupplierFilterBar({ filters, onChange }: SupplierFilterBarProps) {
  const hasFilters = filters.country !== null || filters.category !== null;
  return (
    <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Filtros del directorio">
      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        País
        <select
          className={SELECT_CLASSES}
          value={filters.country ?? ''}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange({ ...filters, country: toCountry(event.target.value) })}
        >
          <option value="">Todos los países</option>
          {SUPPLIER_COUNTRIES.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Categoría
        <select
          className={SELECT_CLASSES}
          value={filters.category ?? ''}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            onChange({ ...filters, category: toCategory(event.target.value) })
          }
        >
          <option value="">Todas las categorías</option>
          {SUPPLIER_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>
      {hasFilters && (
        <Button variant="secondary" onClick={() => onChange({ country: null, category: null })}>
          Quitar filtros
        </Button>
      )}
    </div>
  );
}
