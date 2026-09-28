// Formato de presentación del directorio de proveedores (es-ES). Solo
// presentación: los valores llegan ya validados por la API.

import type { SupplierCurrency } from '@/types/suppliers';

const DATE_TIME = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
// Fechas `YYYY-MM-DD` (sin hora): se formatean en UTC para no desplazar el día.
const DATE_ONLY = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeZone: 'UTC' });

export function formatRate(amount: number, currency: SupplierCurrency): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(amount);
}

/** `updated_at` (ISO 8601 UTC) en la hora local del navegador. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DATE_TIME.format(date);
}

export function formatDate(yyyyMmDd: string): string {
  const date = new Date(`${yyyyMmDd}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? yyyyMmDd : DATE_ONLY.format(date);
}
