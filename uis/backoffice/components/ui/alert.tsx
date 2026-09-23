import type { ReactNode } from 'react';

type AlertVariant = 'error' | 'info';

export interface AlertProps {
  variant: AlertVariant;
  title: string;
  children?: ReactNode;
  id?: string;
}

const VARIANT_CLASSES: Record<AlertVariant, string> = {
  error: 'border-danger-ink/30 bg-danger-surface text-danger-ink',
  info: 'border-info-ink/30 bg-info-surface text-info-ink',
};

// El tipo de aviso se indica también en texto (prefijo oculto + título), no
// solo con color. Los errores se anuncian al aparecer (role="alert"); la
// información, de forma no intrusiva (role="status").
const VARIANT_PREFIX: Record<AlertVariant, string> = {
  error: 'Error: ',
  info: 'Información: ',
};

export function Alert({ variant, title, children, id }: AlertProps) {
  return (
    <div
      id={id}
      role={variant === 'error' ? 'alert' : 'status'}
      className={`rounded-control border border-l-4 px-4 py-3 text-sm ${VARIANT_CLASSES[variant]}`}
    >
      <p className="font-semibold">
        <span className="sr-only">{VARIANT_PREFIX[variant]}</span>
        {title}
      </p>
      {children !== undefined && <div className="mt-1 text-ink">{children}</div>}
    </div>
  );
}
