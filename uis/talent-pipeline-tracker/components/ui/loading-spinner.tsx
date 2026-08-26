export interface LoadingSpinnerProps {
  label?: string;
  size?: 'sm' | 'md';
}

const SIZE_CLASSES: Record<'sm' | 'md', string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
};

// role="status" es la excepción explícita de §2.4: no hay equivalente en
// HTML semántico para anunciar un estado de carga a lectores de pantalla.
export function LoadingSpinner({ label = 'Cargando…', size = 'md' }: LoadingSpinnerProps) {
  return (
    <span role="status" className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`animate-spin rounded-full border-border border-t-brand ${SIZE_CLASSES[size]}`}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
