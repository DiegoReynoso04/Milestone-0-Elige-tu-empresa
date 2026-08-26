'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

export interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

// <dialog> nativo en vez de un div + ARIA a mano: el navegador se encarga
// del atrapado de foco y del cierre con Escape al abrirlo con showModal()
// (§2.4 exige gestión correcta del foco en modales). Solo sincronizamos
// showModal()/close() con la prop `open` y escuchamos el evento `close`
// nativo para que un cierre por Escape también actualice el estado de React.
export function Modal({ open, title, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClick={(event) => {
        // Clic en el ::backdrop cae sobre el propio <dialog> como target.
        if (event.target === dialogRef.current) onClose();
      }}
      // El navegador centra un <dialog> modal con `inset: 0` + `margin: auto`,
      // pero el preflight de Tailwind pone `margin: 0` en todos los elementos
      // (incluido <dialog>), lo que rompe ese centrado y deja el modal pegado
      // al borde izquierdo. `m-auto` lo restaura sin tocar el posicionamiento
      // nativo.
      className="m-auto w-full max-w-lg rounded-control border border-border bg-surface p-0 text-ink open:flex open:flex-col backdrop:bg-ink/40"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 id={titleId} className="text-base font-semibold text-ink">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="rounded-control p-1 text-ink-muted outline-none hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          ✕
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
    </dialog>
  );
}
