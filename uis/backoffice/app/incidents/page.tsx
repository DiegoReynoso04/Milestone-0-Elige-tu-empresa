import type { Metadata } from 'next';

import { IncidentAnalysisView } from '@/components/incidents/incident-analysis-view';

// Server Component: exporta la metadata (solo se permite en el servidor) y
// renderiza la vista interactiva, que es un Client Component ('use client').
export const metadata: Metadata = {
  title: 'Análisis de incidentes · Nexova',
  description: 'Análisis del CSV de incidentes de soporte de Nexova mediante la API local del backoffice.',
};

export default function IncidentsPage() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold text-ink">Análisis de incidentes</h1>
        <p className="text-sm text-ink-muted">
          Procesa el CSV de tickets de soporte exportado del helpdesk de Nexova: valida cada registro y muestra totales,
          reglas de invalidación, categorías, estados y satisfacción. El análisis lo hace la API local; el contenido del
          archivo no se muestra ni se envía a servicios externos.
        </p>
      </div>
      <IncidentAnalysisView />
    </>
  );
}
