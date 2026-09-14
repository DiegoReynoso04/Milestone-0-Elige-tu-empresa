/**
 * Datos corporativos de Nexova Solutions.
 *
 * Cada campo está respaldado literalmente por `contexts/CONTEXT.md`
 * (sección "Bienvenido a Nexova Solutions"; esa carpeta es local y no viaja
 * con el repositorio — ver `memory-bank/techContext.md`). El resumen
 * versionado de estos mismos datos vive en `memory-bank/projectbrief.md`.
 * No añadir un campo aquí sin poder señalar la frase exacta que lo respalda
 * — ver `.agents/rules/nexova-context.md`.
 */
export interface CompanyInfo {
  name: string;
  founded: number;
  headquarters: string;
  expansionOffice: string;
  employees: number;
  /** Aproximado — "factura aproximadamente 8 millones de dólares anuales". */
  annualRevenueUSD: number;
  ceo: string;
  businessLines: readonly string[];
}

export const NEXOVA_COMPANY: CompanyInfo = {
  // "Nexova Solutions es una consultora de recursos humanos y selección de
  // talento fundada en 2011"
  name: "Nexova Solutions",
  founded: 2011,
  // "con sede en Valencia, España, y una oficina de expansión en Miami, Florida"
  headquarters: "Valencia, España",
  expansionOffice: "Miami, Florida",
  // "La empresa cuenta con 120 empleados"
  employees: 120,
  // "factura aproximadamente 8 millones de dólares anuales"
  annualRevenueUSD: 8_000_000,
  // "Nexova está liderada por Laura Mendoza, CEO desde la fundación de la empresa"
  ceo: "Laura Mendoza",
  // "a través de tres líneas de negocio: headhunting para perfiles de mandos
  // medios y directivos, outsourcing de equipos de soporte al cliente para
  // empresas tecnológicas, y formación corporativa en habilidades blandas y
  // liderazgo"
  businessLines: [
    "Headhunting de mandos medios y directivos",
    "Outsourcing de equipos de soporte al cliente para empresas tecnológicas",
    "Formación corporativa en habilidades blandas y liderazgo",
  ],
};

/**
 * Áreas internas de Nexova descritas en `contexts/CONTEXT.md` que todavía
 * no tienen una herramienta propia en este monorepo. Roadmap, no features
 * implementadas — no añadir lógica aquí sin un contexto de hito propio.
 */
export interface PendingArea {
  department: string;
  owner: string;
  /** Frase literal (o casi literal) del problema descrito en CONTEXT.md. */
  problem: string;
}

export const PENDING_INTERNAL_AREAS: readonly PendingArea[] = [
  {
    department: "Recursos Humanos (interno)",
    owner: "Patricia Solís",
    problem:
      "Vacaciones, ausencias y consultas de RRHH se gestionan por email y hojas de cálculo; sin métricas de rotación ni absentismo.",
  },
  {
    department: "Ventas y Desarrollo de Negocio",
    owner: "Megan Clarke",
    problem:
      "Prospección manual en LinkedIn, CRM (HubSpot) actualizado solo por el 40% del equipo, deals perdidos por falta de seguimiento.",
  },
  {
    department: "Dirección Ejecutiva",
    owner: "Laura Mendoza",
    problem:
      "Informe semanal en PDF preparado manualmente por cada responsable de área (4-8 horas por manager), sin visión unificada del negocio.",
  },
];
