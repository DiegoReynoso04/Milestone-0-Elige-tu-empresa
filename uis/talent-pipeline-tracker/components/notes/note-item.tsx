'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { formatDate } from '@/lib/format';
import type { Note } from '@/types/record';

export interface NoteItemProps {
  note: Note;
  onDelete: (noteId: string) => Promise<boolean>;
  isDeleting: boolean;
  isDeleteBlocked: boolean;
}

// Una nota + confirmación de borrado (REQ-3). Las notas no tienen
// updated_at: no existe edición (§4.8.3), solo lectura y baja.
export function NoteItem({ note, onDelete, isDeleting, isDeleteBlocked }: NoteItemProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  async function handleConfirmDelete() {
    const ok = await onDelete(note.id);
    // Si falla, el diálogo se queda abierto para reintentar; el motivo se
    // muestra en el aviso general de notes-list.tsx (la reversión nunca es
    // silenciosa).
    if (ok) setIsConfirmOpen(false);
  }

  return (
    <li className="flex flex-col gap-2 rounded-control border border-border bg-surface p-4">
      <p className="whitespace-pre-wrap text-sm text-ink">{note.content}</p>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-ink-muted">{formatDate(note.created_at)}</span>
        <Button
          type="button"
          variant="danger"
          onClick={() => setIsConfirmOpen(true)}
          disabled={isDeleteBlocked}
        >
          Eliminar
        </Button>
      </div>

      {/* <dialog> nativo: foco gestionado por el navegador al abrir con
          showModal() (§2.4), igual que en candidate-form.tsx. */}
      <Modal open={isConfirmOpen} title="Eliminar nota" onClose={() => setIsConfirmOpen(false)}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink">¿Eliminar esta nota? Esta acción no se puede deshacer.</p>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              isLoading={isDeleting}
              disabled={isDeleteBlocked}
              onClick={handleConfirmDelete}
            >
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </li>
  );
}
