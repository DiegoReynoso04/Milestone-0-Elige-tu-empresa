'use client';

import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { describeApiError } from '@/lib/api-client';

export interface NoteFormProps {
  onSubmit: (content: string) => Promise<boolean>;
  isSubmitting: boolean;
  error: Error | null;
}

// Alta de notas (REQ-3): minLength 1 y no solo espacios en blanco,
// replicado en cliente antes de enviar (§4.5). Sin <input>/<select>
// reutilizables para textarea en ui/, así que el <label>/<textarea> se
// asocian aquí a mano, mismo patrón de aria-invalid/aria-describedby que
// components/ui/input.tsx.
export function NoteForm({ onSubmit, isSubmitting, error }: NoteFormProps) {
  const [content, setContent] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const textareaId = useId();
  const errorId = `${textareaId}-error`;

  const displayError = validationError ?? (error ? describeApiError(error) : null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return; // evita envíos duplicados (REQ-5)

    const trimmed = content.trim();
    if (!trimmed) {
      setValidationError('La nota no puede estar vacía.');
      return;
    }

    setValidationError(null);
    const ok = await onSubmit(trimmed);
    if (ok) setContent('');
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2">
      <label htmlFor={textareaId} className="text-sm font-medium text-ink">
        Añadir nota
      </label>
      <textarea
        id={textareaId}
        value={content}
        onChange={(event) => {
          setContent(event.target.value);
          if (validationError) setValidationError(null);
        }}
        disabled={isSubmitting}
        aria-invalid={displayError ? true : undefined}
        aria-describedby={displayError ? errorId : undefined}
        rows={3}
        className={`rounded-control border px-3 py-2 text-sm text-ink bg-surface outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${displayError ? 'border-danger-ink' : 'border-border'}`}
      />
      {displayError && (
        <p id={errorId} role="alert" className="text-sm text-danger-ink">
          {displayError}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
          Añadir nota
        </Button>
      </div>
    </form>
  );
}
