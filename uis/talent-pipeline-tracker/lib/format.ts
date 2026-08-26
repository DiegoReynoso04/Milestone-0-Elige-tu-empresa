// Formato defensivo (§4.2): ninguna función lanza. Ante un valor no
// parseable, el llamador recibe el string crudo o null y decide el fallback.

const DATE_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

// applied_at/updated_at llegan como string sin garantía contractual de
// formato. Si new Date() produce Invalid Date, se devuelve el string crudo:
// nunca "Invalid Date" ni "NaN".
export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return DATE_FORMATTER.format(date);
}

// linkedin_url/cv_url no son fiables (§4.2: pueden traer markdown crudo u
// otro texto no válido). Nunca insertar en un href sin pasar por aquí antes.
export function toSafeHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}
