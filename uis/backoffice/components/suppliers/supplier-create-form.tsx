import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import type { CreateState } from '@/hooks/use-supplier-directory';
import { validateSupplierForm } from '@/services/suppliers.service';
import {
  SUPPLIER_CATEGORIES,
  SUPPLIER_COUNTRIES,
  SUPPLIER_CURRENCIES,
  SUPPLIER_STATUSES,
  type FieldError,
  type SupplierCategory,
  type SupplierField,
  type SupplierFormValues,
} from '@/types/suppliers';

import { SupplierError } from './supplier-error';

export const EMPTY_SUPPLIER_FORM: SupplierFormValues = {
  name: '',
  country: '',
  categories: [],
  monthly_rate: '',
  currency: '',
  status: 'active',
  contract_renewal_date: '',
  contact_email: '',
  notes: '',
};

export interface SupplierCreateFormProps {
  create: CreateState;
  onSubmit: (values: SupplierFormValues) => void;
  onCancel: () => void;
}

const CONTROL_CLASSES =
  'w-full rounded-control border bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

function pick<T extends string>(values: readonly T[], value: string): T | '' {
  return values.find((candidate) => candidate === value) ?? '';
}

// Formulario de alta (POST /suppliers). Valida en cliente los campos
// requeridos antes de enviar; el resto de reglas (moneda coherente con el
// país, fecha válida…) las aplica la API y sus errores 422 se muestran por campo.
export function SupplierCreateForm({ create, onSubmit, onCancel }: SupplierCreateFormProps) {
  const [values, setValues] = useState<SupplierFormValues>(EMPTY_SUPPLIER_FORM);
  // Errores de cliente del último intento; se recalculan al enviar.
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const isSubmitting = create.status === 'submitting';
  const apiError = create.status === 'error' ? create.error : null;
  const errors: readonly FieldError[] =
    clientErrors.length > 0 ? clientErrors : apiError?.kind === 'validation' ? apiError.errors : [];

  function set<K extends keyof SupplierFormValues>(key: K, value: SupplierFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function toggleCategory(category: SupplierCategory, checked: boolean) {
    setValues((current) => ({
      ...current,
      categories: checked
        ? SUPPLIER_CATEGORIES.filter((item) => item === category || current.categories.includes(item))
        : current.categories.filter((item) => item !== category),
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateSupplierForm(values);
    setClientErrors(validation);
    setAttempt((current) => current + 1);
    if (validation.length === 0) onSubmit(values);
  }

  function errorFor(field: SupplierField): string | null {
    return errors.find((error) => error.field === field)?.message ?? null;
  }

  const summaryError =
    clientErrors.length > 0 ? { kind: 'validation' as const, source: 'client' as const, errors: clientErrors } : apiError;

  // Tras un intento fallido (cliente o API) el foco va al resumen de errores,
  // que puede quedar fuera de la vista en formularios largos.
  const summaryRef = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const hasSummary = summaryError !== null;
  useEffect(() => {
    if (attempt > 0 && hasSummary) summaryRef.current?.focus();
  }, [attempt, hasSummary, apiError]);

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4" aria-describedby="create-form-help">
      <p id="create-form-help" className="text-xs text-ink-muted">
        Los campos marcados con * son obligatorios. La moneda debe corresponder al país del contrato (Spain → EUR, USA → USD).
      </p>

      {summaryError !== null && (
        <div ref={summaryRef} tabIndex={-1} className="outline-none">
          <SupplierError error={summaryError} id="create-form-errors" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nombre *" htmlFor="supplier-name" error={errorFor('name')}>
          <input
            id="supplier-name"
            value={values.name}
            onChange={(event) => set('name', event.target.value)}
            aria-invalid={errorFor('name') !== null}
            aria-describedby={errorFor('name') !== null ? 'supplier-name-error' : undefined}
            className={`${CONTROL_CLASSES} ${borderFor(errorFor('name'))}`}
          />
        </Field>

        <Field label="Tarifa mensual *" htmlFor="supplier-rate" error={errorFor('monthly_rate')}>
          <input
            id="supplier-rate"
            inputMode="decimal"
            autoComplete="off"
            value={values.monthly_rate}
            onChange={(event) => set('monthly_rate', event.target.value)}
            aria-invalid={errorFor('monthly_rate') !== null}
            aria-describedby={errorFor('monthly_rate') !== null ? 'supplier-rate-error' : undefined}
            className={`${CONTROL_CLASSES} ${borderFor(errorFor('monthly_rate'))}`}
          />
        </Field>

        <Field label="País *" htmlFor="supplier-country" error={errorFor('country')}>
          <select
            id="supplier-country"
            value={values.country}
            onChange={(event) => set('country', pick(SUPPLIER_COUNTRIES, event.target.value))}
            aria-invalid={errorFor('country') !== null}
            aria-describedby={errorFor('country') !== null ? 'supplier-country-error' : undefined}
            className={`${CONTROL_CLASSES} ${borderFor(errorFor('country'))}`}
          >
            <option value="">Selecciona…</option>
            {SUPPLIER_COUNTRIES.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Moneda *" htmlFor="supplier-currency" error={errorFor('currency')}>
          <select
            id="supplier-currency"
            value={values.currency}
            onChange={(event) => set('currency', pick(SUPPLIER_CURRENCIES, event.target.value))}
            aria-invalid={errorFor('currency') !== null}
            aria-describedby={errorFor('currency') !== null ? 'supplier-currency-error' : undefined}
            className={`${CONTROL_CLASSES} ${borderFor(errorFor('currency'))}`}
          >
            <option value="">Selecciona…</option>
            {SUPPLIER_CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Estado *" htmlFor="supplier-status" error={errorFor('status')}>
          <select
            id="supplier-status"
            value={values.status}
            onChange={(event) => set('status', pick(SUPPLIER_STATUSES, event.target.value))}
            aria-invalid={errorFor('status') !== null}
            aria-describedby={errorFor('status') !== null ? 'supplier-status-error' : undefined}
            className={`${CONTROL_CLASSES} ${borderFor(errorFor('status'))}`}
          >
            <option value="">Selecciona…</option>
            {SUPPLIER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Fecha de renovación" htmlFor="supplier-renewal" error={errorFor('contract_renewal_date')}>
          <input
            id="supplier-renewal"
            type="date"
            value={values.contract_renewal_date}
            onChange={(event) => set('contract_renewal_date', event.target.value)}
            aria-invalid={errorFor('contract_renewal_date') !== null}
            aria-describedby={errorFor('contract_renewal_date') !== null ? 'supplier-renewal-error' : undefined}
            className={`${CONTROL_CLASSES} ${borderFor(errorFor('contract_renewal_date'))}`}
          />
        </Field>

        <Field label="Email de contacto" htmlFor="supplier-email" error={errorFor('contact_email')}>
          <input
            id="supplier-email"
            type="email"
            value={values.contact_email}
            onChange={(event) => set('contact_email', event.target.value)}
            aria-invalid={errorFor('contact_email') !== null}
            aria-describedby={errorFor('contact_email') !== null ? 'supplier-email-error' : undefined}
            className={`${CONTROL_CLASSES} ${borderFor(errorFor('contact_email'))}`}
          />
        </Field>
      </div>

      <fieldset
        className="flex flex-col gap-2"
        aria-invalid={errorFor('categories') !== null}
        aria-describedby={errorFor('categories') !== null ? 'supplier-categories-error' : undefined}
      >
        <legend className="text-sm font-medium text-ink">Categorías * (al menos una)</legend>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
          {SUPPLIER_CATEGORIES.map((category) => (
            <label key={category} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={values.categories.includes(category)}
                onChange={(event) => toggleCategory(category, event.target.checked)}
                className="h-4 w-4 accent-brand"
              />
              <span className="font-mono text-xs">{category}</span>
            </label>
          ))}
        </div>
        {errorFor('categories') !== null && (
          <p id="supplier-categories-error" className="text-xs font-medium text-danger-ink">
            {errorFor('categories')}
          </p>
        )}
      </fieldset>

      <Field label="Notas" htmlFor="supplier-notes" error={errorFor('notes')}>
        <textarea
          id="supplier-notes"
          rows={2}
          value={values.notes}
          onChange={(event) => set('notes', event.target.value)}
          className={`${CONTROL_CLASSES} ${borderFor(errorFor('notes'))}`}
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" isLoading={isSubmitting}>
          {isSubmitting ? 'Registrando…' : 'Registrar proveedor'}
        </Button>
        <Button variant="secondary" disabled={isSubmitting} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function borderFor(error: string | null): string {
  return error === null ? 'border-border' : 'border-danger-ink';
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error: string | null;
  children: ReactNode;
}

function Field({ label, htmlFor, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error !== null && (
        <p id={`${htmlFor}-error`} className="text-xs font-medium text-danger-ink">
          {error}
        </p>
      )}
    </div>
  );
}
