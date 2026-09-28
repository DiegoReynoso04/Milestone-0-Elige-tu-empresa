// Datos de prueba del directorio de proveedores (services/api/SPECS.md Parte B).
// Nombres y emails sintéticos (`example.invalid`).

export function supplier(overrides = {}) {
  return {
    id: 1,
    name: 'Synthetic Supplier',
    country: 'Spain',
    categories: ['job_boards'],
    monthly_rate: 100,
    currency: 'EUR',
    updated_at: '2026-09-01T08:00:00Z',
    status: 'active',
    contract_renewal_date: null,
    contact_email: 'account@example.invalid',
    notes: null,
    ...overrides,
  };
}

export function formValues(overrides = {}) {
  return {
    name: 'Synthetic Supplier',
    country: 'Spain',
    categories: ['job_boards'],
    monthly_rate: '100',
    currency: 'EUR',
    status: 'active',
    contract_renewal_date: '',
    contact_email: '',
    notes: '',
    ...overrides,
  };
}

/** Cuerpo 422 con el formato de la API (`{detail: [{loc, msg, type}], code}`). */
export function validationBody(...errors) {
  return { code: 'validation_error', detail: errors.map(([loc, msg]) => ({ loc, msg, type: 'value_error' })) };
}
