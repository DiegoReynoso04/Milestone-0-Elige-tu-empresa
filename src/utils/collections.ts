/**
 * Nexova — Operaciones sobre colecciones de candidatos.
 *
 * Todas las funciones son puras: no mutan los arrays recibidos ni dependen de
 * estado externo. Filtrar y ordenar siempre devuelve una colección nueva.
 */

import type {
  AvailabilityStatus,
  Candidate,
  SeniorityLevel,
  SortOrder,
} from "../types/models.js";

/** Normaliza una habilidad para comparaciones case-insensitive y sin espacios. */
function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase();
}

/** Construye un Set de habilidades normalizadas para búsquedas en O(1). */
function toNormalizedSkillSet(skills: string[]): Set<string> {
  return new Set(skills.map(normalizeSkill));
}

/**
 * Candidatos que poseen TODAS las habilidades requeridas.
 * El matching es case-insensitive. Con `requiredSkills` vacío no se filtra nada.
 */
export function filterCandidatesBySkills(
  candidates: Candidate[],
  requiredSkills: string[],
): Candidate[] {
  if (requiredSkills.length === 0) return [...candidates];

  const normalizedRequired = requiredSkills.map(normalizeSkill);

  return candidates.filter((candidate) => {
    const candidateSkills = toNormalizedSkillSet(candidate.skills);
    return normalizedRequired.every((skill) => candidateSkills.has(skill));
  });
}

/** Candidatos que tienen exactamente el nivel de seniority indicado. */
export function filterCandidatesBySeniority(
  candidates: Candidate[],
  seniority: SeniorityLevel,
): Candidate[] {
  return candidates.filter((candidate) => candidate.seniority === seniority);
}

/**
 * Candidatos cuya disponibilidad coincide con alguno de los estados indicados.
 * Con una lista de estados vacía el resultado es vacío (nadie puede coincidir).
 */
export function filterCandidatesByAvailability(
  candidates: Candidate[],
  availability: AvailabilityStatus[],
): Candidate[] {
  if (availability.length === 0) return [];

  const accepted = new Set<AvailabilityStatus>(availability);
  return candidates.filter((candidate) => accepted.has(candidate.availability));
}

/** Candidatos que aceptan la modalidad de la vacante (remota o presencial). */
export function filterCandidatesByRemotePreference(
  candidates: Candidate[],
  isRemote: boolean,
): Candidate[] {
  if (isRemote) return [...candidates];
  return candidates.filter((candidate) => !candidate.remoteOnly);
}

/** Multiplicador de comparación según la dirección de ordenamiento. */
function directionFactor(order: SortOrder): 1 | -1 {
  return order === "asc" ? 1 : -1;
}

/**
 * Copia ordenada por salario esperado. No muta el array original.
 */
export function sortCandidatesBySalary(
  candidates: Candidate[],
  order: SortOrder,
): Candidate[] {
  const factor = directionFactor(order);
  return [...candidates].sort(
    (a, b) => (a.expectedSalary - b.expectedSalary) * factor,
  );
}

/**
 * Copia ordenada por años de experiencia. No muta el array original.
 */
export function sortCandidatesByExperience(
  candidates: Candidate[],
  order: SortOrder,
): Candidate[] {
  const factor = directionFactor(order);
  return [...candidates].sort(
    (a, b) => (a.yearsOfExperience - b.yearsOfExperience) * factor,
  );
}

/**
 * Copia ordenada alfabéticamente por nombre completo.
 * Usa `localeCompare` para respetar acentos y ñ del español.
 */
export function sortCandidatesByName(
  candidates: Candidate[],
  order: SortOrder,
): Candidate[] {
  const factor = directionFactor(order);
  return [...candidates].sort(
    (a, b) => a.fullName.localeCompare(b.fullName, "es") * factor,
  );
}
