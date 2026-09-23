export interface LoadingSpinnerProps {
  /** Texto para lectores de pantalla. Si no se indica, el spinner es decorativo. */
  label?: string;
  size?: 'sm' | 'md';
}

const SIZE_CLASSES: Record<'sm' | 'md', string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-5 w-5 border-2',
};

// Con `label` anuncia el estado (role="status" + texto oculto). Sin `label` es
// solo visual: úsalo así cuando el texto visible de al lado ya lo explica.
export function LoadingSpinner({ label, size = 'md' }: LoadingSpinnerProps) {
  const circle = (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-border border-t-brand motion-reduce:animate-none ${SIZE_CLASSES[size]}`}
    />
  );
  if (label === undefined) return circle;
  return (
    <span role="status" className="inline-flex items-center">
      {circle}
      <span className="sr-only">{label}</span>
    </span>
  );
}
