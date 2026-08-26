import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LoadingSpinner } from './loading-spinner';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-brand-contrast hover:bg-brand-strong',
  secondary: 'bg-surface text-ink border border-border hover:bg-canvas',
  danger: 'bg-danger-surface text-danger-ink border border-danger-ink/20 hover:bg-danger-ink hover:text-white',
};

// <button> real, nunca un <div> con onClick. type="button" por defecto para
// no disparar submits accidentales dentro de un <form>.
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
      className={`inline-flex items-center justify-center gap-2 rounded-control border border-transparent px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {isLoading && <LoadingSpinner size="sm" label="Procesando…" />}
      {children}
    </button>
  );
}
