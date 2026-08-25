/**
 * Nexova — Modelos de dominio
 *
 * Entidades principales del sistema de gestión de candidatos:
 * Candidate, Vacancy y SelectionProcess.
 */

// ---------------------------------------------------------------------------
// Tipos union del dominio
// ---------------------------------------------------------------------------

export type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "Native";

export type SeniorityLevel =
  | "Junior"
  | "Semi-Senior"
  | "Senior"
  | "Lead"
  | "Executive";

export type AvailabilityStatus =
  | "Immediate"
  | "2 weeks"
  | "1 month"
  | "Not available";

export type CandidateStatus = "Active" | "In process" | "Hired" | "Inactive";

export type VacancyStatus = "Open" | "In progress" | "Closed" | "On hold";

export type ProcessStage =
  | "Screening"
  | "Interview"
  | "Technical test"
  | "Final interview"
  | "Offer"
  | "Rejected"
  | "Hired";

/** Dirección de ordenamiento para las funciones de sorting. */
export type SortOrder = "asc" | "desc";

// ---------------------------------------------------------------------------
// Entidades
// ---------------------------------------------------------------------------

/** Persona registrada en la base de talento de Nexova. */
export interface Candidate {
  /** Identificador único (ej: "C-2024-0451"). */
  id: string;
  fullName: string;
  email: string;
  phone: string;
  /** Años totales de experiencia profesional. */
  yearsOfExperience: number;
  /** Habilidades declaradas (ej: ["TypeScript", "React"]). */
  skills: string[];
  englishLevel: EnglishLevel;
  seniority: SeniorityLevel;
  /** Salario actual en USD. */
  currentSalary: number;
  /** Salario esperado en USD. */
  expectedSalary: number;
  availability: AvailabilityStatus;
  /** Ciudad y país (ej: "Valencia, España"). */
  location: string;
  /** Solo acepta posiciones remotas. */
  remoteOnly: boolean;
  status: CandidateStatus;
}

/** Posición abierta que Nexova intenta cubrir para una empresa cliente. */
export interface Vacancy {
  /** Identificador único (ej: "V-2024-0892"). */
  id: string;
  title: string;
  companyName: string;
  /** Habilidades obligatorias. */
  requiredSkills: string[];
  /** Habilidades deseables (suman puntos extra en el scoring). */
  preferredSkills: string[];
  minYearsExperience: number;
  maxYearsExperience: number;
  requiredEnglishLevel: EnglishLevel;
  requiredSeniority: SeniorityLevel;
  /** Salario mínimo ofrecido en USD. */
  salaryRangeMin: number;
  /** Salario máximo ofrecido en USD. */
  salaryRangeMax: number;
  isRemote: boolean;
  /** Ubicación de oficina si la posición no es remota. */
  location: string;
  status: VacancyStatus;
}

/** Avance de un candidato dentro del proceso de selección de una vacante. */
export interface SelectionProcess {
  /** Identificador único (ej: "SP-2024-1523"). */
  id: string;
  candidateId: string;
  vacancyId: string;
  stage: ProcessStage;
  /** Puntaje de match calculado (0-100). */
  score: number;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Tipos auxiliares de salida
// ---------------------------------------------------------------------------

/** Resultado de una validación de negocio. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Candidato acompañado de su puntaje de match contra una vacante. */
export interface ScoredCandidate {
  candidate: Candidate;
  score: number;
}

/** Habilidad junto a la cantidad de candidatos que la declaran. */
export interface SkillCount {
  skill: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Escalas ordinales
//
// Se exponen como tuplas `readonly` para poder derivar el orden relativo entre
// niveles (necesario en el scoring) sin duplicar los literales.
// ---------------------------------------------------------------------------

export const ENGLISH_LEVELS = [
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
  "Native",
] as const satisfies readonly EnglishLevel[];

export const SENIORITY_LEVELS = [
  "Junior",
  "Semi-Senior",
  "Senior",
  "Lead",
  "Executive",
] as const satisfies readonly SeniorityLevel[];

export const CANDIDATE_STATUSES = [
  "Active",
  "In process",
  "Hired",
  "Inactive",
] as const satisfies readonly CandidateStatus[];

/**
 * Posición ordinal de un nivel de inglés (A1 = 0 … Native = 6).
 * Permite comparar si un candidato cumple o excede el nivel requerido.
 */
export function getEnglishLevelRank(level: EnglishLevel): number {
  return ENGLISH_LEVELS.indexOf(level);
}

/**
 * Posición ordinal de un nivel de seniority (Junior = 0 … Executive = 4).
 * Permite medir la distancia entre el seniority del candidato y el de la vacante.
 */
export function getSeniorityRank(level: SeniorityLevel): number {
  return SENIORITY_LEVELS.indexOf(level);
}

// ---------------------------------------------------------------------------
// Datos de ejemplo (objetos literales) — usados para pruebas manuales
// ---------------------------------------------------------------------------

export const sampleCandidates: Candidate[] = [
  {
    id: "C-2024-0451",
    fullName: "María González",
    email: "maria.gonzalez@email.com",
    phone: "+56912345678",
    yearsOfExperience: 5,
    skills: ["TypeScript", "React", "Node.js", "PostgreSQL"],
    englishLevel: "B2",
    seniority: "Semi-Senior",
    currentSalary: 3500,
    expectedSalary: 4200,
    availability: "1 month",
    location: "Valencia, España",
    remoteOnly: false,
    status: "Active",
  },
  {
    id: "C-2024-0452",
    fullName: "Juan Pérez",
    email: "juan.perez@email.com",
    phone: "+56987654321",
    yearsOfExperience: 3,
    skills: ["JavaScript", "React", "CSS", "HTML"],
    englishLevel: "B1",
    seniority: "Junior",
    currentSalary: 2200,
    expectedSalary: 2800,
    availability: "Immediate",
    location: "Miami, Florida, Estados Unidos",
    remoteOnly: true,
    status: "Active",
  },
  {
    id: "C-2024-0453",
    fullName: "Carolina Silva",
    email: "carolina.silva@email.com",
    phone: "+56911223344",
    yearsOfExperience: 8,
    skills: ["TypeScript", "Node.js", "PostgreSQL", "Docker", "AWS"],
    englishLevel: "C1",
    seniority: "Senior",
    currentSalary: 5500,
    expectedSalary: 6500,
    availability: "2 weeks",
    location: "Valencia, España",
    remoteOnly: false,
    status: "Active",
  },
];

export const sampleVacancy: Vacancy = {
  id: "V-2024-0892",
  title: "Senior Full-Stack Developer",
  companyName: "TechCorp Solutions",
  requiredSkills: ["TypeScript", "React", "Node.js"],
  preferredSkills: ["PostgreSQL", "Docker"],
  minYearsExperience: 4,
  maxYearsExperience: 8,
  requiredEnglishLevel: "B2",
  requiredSeniority: "Senior",
  salaryRangeMin: 5000,
  salaryRangeMax: 7000,
  isRemote: true,
  location: "Remote",
  status: "Open",
};
