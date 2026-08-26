import Link from 'next/link';

// Segmento de not-found (REQ-3): se renderiza cuando notFound() se invoca
// en candidate-detail.tsx tras un 404 real de la API. Sin 'use client': no
// necesita estado ni props especiales.
export default function CandidateNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start gap-3 px-4 py-16">
      <h1 className="text-xl font-semibold text-ink">Candidatura no encontrada</h1>
      <p className="text-sm text-ink-muted">
        No existe ninguna candidatura con este identificador. Puede haber sido eliminada o el
        enlace puede ser incorrecto.
      </p>
      <Link
        href="/"
        className="text-sm text-brand underline-offset-2 outline-none hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        ← Volver al listado
      </Link>
    </main>
  );
}
