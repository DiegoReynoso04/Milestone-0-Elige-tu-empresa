import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { LoadingSpinner } from './loading-spinner';

type ButtonVariant = 'primary' | 'secondary';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Muestra un spinner, deshabilita el botón y marca `aria-busy`. */
  isLoading?: boolean;
  children: ReactNode;
}

// El color del borde va en cada variante (no en la base): dos utilidades de
// color de borde en la misma clase se resuelven por el orden del CSS generado.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-brand text-brand-contrast hover:bg-brand-strong',
  secondary: 'border-border bg-surface text-ink hover:bg-canvas',
};

// <button> real, nunca un <div> con onClick. type="button" por defecto para no
// enviar formularios por accidente (patrón de uis/talent-pipeline-tracker).
export function Button({
  variant = 'primary',
  isLoading = false,
  disabled,
  type = 'button',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-control border px-4 py-2 text-sm font-medium transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {/* Decorativo: el texto del botón ya describe el estado ("Analizando…"). */}
      {isLoading && <LoadingSpinner size="sm" />}
      {children}
    </button>
  );
}
