'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';

export type ToastVariant = 'success' | 'error';

export interface ToastMessage {
  id: string;
  variant: ToastVariant;
  message: string;
}

type ToastAction = { type: 'add'; toast: ToastMessage } | { type: 'remove'; id: string };

function toastReducer(state: ToastMessage[], action: ToastAction): ToastMessage[] {
  switch (action.type) {
    case 'add':
      return [...state, action.toast];
    case 'remove':
      return state.filter((toast) => toast.id !== action.id);
    default:
      return state;
  }
}

export interface ToastContextValue {
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 5000;
let toastIdCounter = 0;

// Contexto propio con useContext + useReducer, sin librerías externas
// (REQ-4/REQ-5). Éxito en una región aria-live="polite", error en una
// aria-live="assertive" — dos regiones separadas para no forzar la
// urgencia de un error sobre un aviso de éxito ni viceversa. Auto-descarte
// a los 5s + cierre manual con un <button> real (accesible por teclado).
// El toast nunca recibe foco programático: solo se anuncia.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const remove = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    dispatch({ type: 'remove', id });
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      toastIdCounter += 1;
      const id = `toast-${toastIdCounter}`;
      dispatch({ type: 'add', toast: { id, variant, message } });
      timers.current.set(
        id,
        setTimeout(() => remove(id), AUTO_DISMISS_MS)
      );
    },
    [remove]
  );

  const notifySuccess = useCallback((message: string) => push('success', message), [push]);
  const notifyError = useCallback((message: string) => push('error', message), [push]);

  // Limpia los temporizadores pendientes si el árbol se desmonta.
  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      activeTimers.forEach((timer) => clearTimeout(timer));
      activeTimers.clear();
    };
  }, []);

  const successToasts = toasts.filter((toast) => toast.variant === 'success');
  const errorToasts = toasts.filter((toast) => toast.variant === 'error');

  return (
    <ToastContext.Provider value={{ notifySuccess, notifyError }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        <div aria-live="polite" className="flex w-full max-w-sm flex-col gap-2">
          {successToasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={remove} />
          ))}
        </div>
        <div aria-live="assertive" className="flex w-full max-w-sm flex-col gap-2">
          {errorToasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={remove} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: 'border-success-ink/20 bg-success-surface text-success-ink',
  error: 'border-danger-ink/20 bg-danger-surface text-danger-ink',
};

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  return (
    <div
      className={`pointer-events-auto flex items-center justify-between gap-3 rounded-control border px-4 py-3 text-sm shadow-sm ${VARIANT_CLASSES[toast.variant]}`}
    >
      <p>{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Cerrar aviso"
        className="rounded-control p-1 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        ✕
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe usarse dentro de <ToastProvider>.');
  }
  return context;
}
