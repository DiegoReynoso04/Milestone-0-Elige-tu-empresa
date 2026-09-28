// Renovaciones próximas (docs/ligthweight-storage-api.md, "Restricciones de
// negocio"): los proveedores con `contract_renewal_date` en los próximos 60
// días se destacan visualmente. Es presentación, no una regla que la API
// aplique: por eso se calcula aquí, con la fecha local del navegador.

export const RENEWAL_WINDOW_DAYS = 60;

const DAY_MS = 86_400_000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type RenewalInfo =
  | { kind: 'none' }
  /** Hoy o dentro de los próximos 60 días (incluido el día 60). */
  | { kind: 'upcoming'; daysLeft: number }
  | { kind: 'later' }
  | { kind: 'past' };

/** Días naturales entre hoy (fecha local) y `YYYY-MM-DD`; `null` si la fecha no es válida. */
export function daysUntil(renewalDate: string, today: Date): number | null {
  const match = DATE_PATTERN.exec(renewalDate);
  if (match === null) return null;
  const [, year, month, day] = match;
  const target = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const check = new Date(target);
  if (check.getUTCMonth() !== Number(month) - 1 || check.getUTCDate() !== Number(day)) return null;
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - todayUtc) / DAY_MS);
}

export function renewalInfo(renewalDate: string | null, today: Date): RenewalInfo {
  if (renewalDate === null) return { kind: 'none' };
  const days = daysUntil(renewalDate, today);
  if (days === null) return { kind: 'none' };
  if (days < 0) return { kind: 'past' };
  if (days <= RENEWAL_WINDOW_DAYS) return { kind: 'upcoming', daysLeft: days };
  return { kind: 'later' };
}
