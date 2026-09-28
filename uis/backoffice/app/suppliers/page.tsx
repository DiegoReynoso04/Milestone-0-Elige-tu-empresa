import type { Metadata } from 'next';

import { SupplierDirectoryView } from '@/components/suppliers/supplier-directory-view';

// Server Component: exporta la metadata (solo se permite en el servidor) y
// renderiza la vista interactiva, que es un Client Component ('use client').
export const metadata: Metadata = {
  title: 'Proveedores · Nexova',
  description: 'Directorio oficial de proveedores de Nexova: consulta, alta, tarifas y estado, mediante la API local.',
};

export default function SuppliersPage() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold text-ink">Directorio de proveedores</h1>
        <p className="text-sm text-ink-muted">
          Registro único de los servicios externos que contrata Nexova. Filtra por país o categoría, registra proveedores
          nuevos, actualiza la tarifa mensual (queda registrada la fecha del cambio) y activa o suspende proveedores. Los
          suspendidos no se eliminan: se conservan para mantener el historial.
        </p>
      </div>
      <SupplierDirectoryView />
    </>
  );
}
