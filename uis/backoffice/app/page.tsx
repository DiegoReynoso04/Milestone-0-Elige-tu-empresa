import { NEXOVA_COMPANY, PENDING_INTERNAL_AREAS } from '@/lib/company';

function formatUSD(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function HomePage() {
  const company = NEXOVA_COMPANY;

  return (
    <>
      <section aria-labelledby="company-heading" className="rounded-lg border border-border bg-surface p-6">
        <h1 id="company-heading" className="text-lg font-semibold text-ink">
          {company.name}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Ficha de empresa — fuente:{' '}
          <code className="rounded bg-canvas px-1 py-0.5 text-xs">contexts/CONTEXT.md</code>
        </p>

        <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Fundación</dt>
            <dd className="text-sm text-ink">{company.founded}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">CEO</dt>
            <dd className="text-sm text-ink">{company.ceo}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Sede</dt>
            <dd className="text-sm text-ink">{company.headquarters}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Oficina de expansión</dt>
            <dd className="text-sm text-ink">{company.expansionOffice}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Empleados</dt>
            <dd className="text-sm text-ink">{company.employees}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Facturación anual (aprox.)</dt>
            <dd className="text-sm text-ink">{formatUSD(company.annualRevenueUSD)}</dd>
          </div>
        </dl>

        <div className="mt-6">
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-muted">Líneas de negocio</h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink">
            {company.businessLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="roadmap-heading" className="rounded-lg border border-border bg-surface p-6">
        <h2 id="roadmap-heading" className="text-sm font-semibold text-ink">
          Áreas internas sin herramienta propia todavía
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Roadmap — no implementado. Cada elemento requiere su propio contexto de hito antes de construirse.
        </p>

        <ul className="mt-4 space-y-4">
          {PENDING_INTERNAL_AREAS.map((area) => (
            <li key={area.department} className="border-t border-border pt-4 first:border-t-0 first:pt-0">
              <p className="text-sm font-medium text-ink">
                {area.department} <span className="font-normal text-ink-muted">— {area.owner}</span>
              </p>
              <p className="mt-1 text-sm text-ink-muted">{area.problem}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
