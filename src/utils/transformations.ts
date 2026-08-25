/**
 * Nexova — Scoring, matching y reportes agregados.
 *
 * Contiene el motor de puntuación candidato/vacante y las agregaciones que
 * alimentan los reportes de selección. Todas las funciones son puras.
 */

import {
  getEnglishLevelRank,
  getSeniorityRank,
  CANDIDATE_STATUSES,
  SENIORITY_LEVELS,
  type Candidate,
  type CandidateStatus,
  type ScoredCandidate,
  type SelectionProcess,
  type SeniorityLevel,
  type SkillCount,
  type Vacancy,
} from "../types/models.js";

// ---------------------------------------------------------------------------
// Constantes del modelo de scoring (peso máximo por dimensión)
// ---------------------------------------------------------------------------

const SKILLS_MAX_POINTS = 40;
const PREFERRED_SKILL_POINTS = 10;
const PREFERRED_SKILLS_MAX_POINTS = 20;
const EXPERIENCE_MAX_POINTS = 20;
const SENIORITY_MAX_POINTS = 15;
const ENGLISH_MAX_POINTS = 15;
const SALARY_MAX_POINTS = 10;

/** Tolerancia en años fuera del rango que aún otorga puntaje parcial. */
const EXPERIENCE_TOLERANCE_YEARS = 2;
/** Sobrecosto salarial aceptado con puntaje parcial (20% sobre el máximo). */
const SALARY_OVERSHOOT_TOLERANCE = 0.2;

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase();
}

function toNormalizedSkillSet(skills: string[]): Set<string> {
  return new Set(skills.map(normalizeSkill));
}

/** Redondea a 2 decimales evitando el ruido de punto flotante. */
function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Cuántas habilidades de `required` posee el candidato. */
function countMatchingSkills(
  candidateSkills: Set<string>,
  required: string[],
): number {
  return required.filter((skill) => candidateSkills.has(normalizeSkill(skill)))
    .length;
}

// ---------------------------------------------------------------------------
// Scoring por dimensión
// ---------------------------------------------------------------------------

/**
 * Puntaje de habilidades (0-40).
 * Base: 40 si tiene todas las requeridas, 20 si tiene al menos el 50%.
 * Bonus: 10 por cada habilidad preferida (tope 20). El total se limita a 40.
 */
export function scoreSkillsMatch(
  candidate: Candidate,
  vacancy: Vacancy,
): number {
  const candidateSkills = toNormalizedSkillSet(candidate.skills);
  const { requiredSkills, preferredSkills } = vacancy;

  let basePoints = 0;
  if (requiredSkills.length > 0) {
    const matched = countMatchingSkills(candidateSkills, requiredSkills);
    const coverage = matched / requiredSkills.length;

    if (coverage === 1) {
      basePoints = SKILLS_MAX_POINTS;
    } else if (coverage >= 0.5) {
      basePoints = SKILLS_MAX_POINTS / 2;
    }
  }

  const preferredMatches = countMatchingSkills(candidateSkills, preferredSkills);
  const bonusPoints = Math.min(
    preferredMatches * PREFERRED_SKILL_POINTS,
    PREFERRED_SKILLS_MAX_POINTS,
  );

  return Math.min(basePoints + bonusPoints, SKILLS_MAX_POINTS);
}

/**
 * Puntaje de experiencia (0-20).
 * 20 dentro del rango, 10 si se desvía hasta 2 años, 0 más allá.
 */
export function scoreExperienceMatch(
  candidate: Candidate,
  vacancy: Vacancy,
): number {
  const { yearsOfExperience } = candidate;
  const { minYearsExperience, maxYearsExperience } = vacancy;

  if (
    yearsOfExperience >= minYearsExperience &&
    yearsOfExperience <= maxYearsExperience
  ) {
    return EXPERIENCE_MAX_POINTS;
  }

  const distance =
    yearsOfExperience < minYearsExperience
      ? minYearsExperience - yearsOfExperience
      : yearsOfExperience - maxYearsExperience;

  return distance <= EXPERIENCE_TOLERANCE_YEARS
    ? EXPERIENCE_MAX_POINTS / 2
    : 0;
}

/**
 * Puntaje de seniority (0-15).
 * 15 por match exacto, 7 si está un nivel por arriba o por abajo, 0 en otro caso.
 */
export function scoreSeniorityMatch(
  candidate: Candidate,
  vacancy: Vacancy,
): number {
  const distance = Math.abs(
    getSeniorityRank(candidate.seniority) -
      getSeniorityRank(vacancy.requiredSeniority),
  );

  if (distance === 0) return SENIORITY_MAX_POINTS;
  if (distance === 1) return 7;
  return 0;
}

/** Puntaje de inglés (0-15): 15 si cumple o excede el nivel requerido. */
export function scoreEnglishMatch(
  candidate: Candidate,
  vacancy: Vacancy,
): number {
  const meetsRequirement =
    getEnglishLevelRank(candidate.englishLevel) >=
    getEnglishLevelRank(vacancy.requiredEnglishLevel);

  return meetsRequirement ? ENGLISH_MAX_POINTS : 0;
}

/**
 * Puntaje salarial (0-10).
 * 10 si la expectativa cabe en el presupuesto de la vacante (o queda por debajo),
 * 5 si excede el máximo hasta en un 20%, 0 si lo excede más.
 */
export function scoreSalaryMatch(
  candidate: Candidate,
  vacancy: Vacancy,
): number {
  const { expectedSalary } = candidate;
  const { salaryRangeMax } = vacancy;

  if (expectedSalary <= salaryRangeMax) return SALARY_MAX_POINTS;

  const overshootLimit = salaryRangeMax * (1 + SALARY_OVERSHOOT_TOLERANCE);
  return expectedSalary <= overshootLimit ? SALARY_MAX_POINTS / 2 : 0;
}

// ---------------------------------------------------------------------------
// Scoring y ranking
// ---------------------------------------------------------------------------

/**
 * Puntaje total de match entre un candidato y una vacante (0-100).
 * Suma las cinco dimensiones: habilidades, experiencia, seniority, inglés y salario.
 */
export function calculateCandidateScore(
  candidate: Candidate,
  vacancy: Vacancy,
): number {
  const total =
    scoreSkillsMatch(candidate, vacancy) +
    scoreExperienceMatch(candidate, vacancy) +
    scoreSeniorityMatch(candidate, vacancy) +
    scoreEnglishMatch(candidate, vacancy) +
    scoreSalaryMatch(candidate, vacancy);

  return Math.min(Math.max(Math.round(total), 0), 100);
}

/**
 * Puntúa a todos los candidatos contra la vacante y los ordena de mayor a menor.
 * Con un array vacío devuelve un array vacío. No muta la colección original.
 */
export function rankCandidatesForVacancy(
  candidates: Candidate[],
  vacancy: Vacancy,
): ScoredCandidate[] {
  return candidates
    .map((candidate) => ({
      candidate,
      score: calculateCandidateScore(candidate, vacancy),
    }))
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Agrupaciones
// ---------------------------------------------------------------------------

/**
 * Agrupa candidatos por seniority.
 * Todos los niveles están presentes en el resultado, incluso los vacíos.
 */
export function groupCandidatesBySeniority(
  candidates: Candidate[],
): Record<SeniorityLevel, Candidate[]> {
  const grouped = Object.fromEntries(
    SENIORITY_LEVELS.map((level) => [level, [] as Candidate[]]),
  ) as Record<SeniorityLevel, Candidate[]>;

  for (const candidate of candidates) {
    grouped[candidate.seniority].push(candidate);
  }

  return grouped;
}

// ---------------------------------------------------------------------------
// Reportes agregados
// ---------------------------------------------------------------------------

/**
 * Conteo de candidatos por estado.
 * Todos los estados aparecen en el resultado, con 0 si no hay candidatos.
 */
export function countCandidatesByStatus(
  candidates: Candidate[],
): Record<CandidateStatus, number> {
  const counts = Object.fromEntries(
    CANDIDATE_STATUSES.map((status) => [status, 0]),
  ) as Record<CandidateStatus, number>;

  for (const candidate of candidates) {
    counts[candidate.status] += 1;
  }

  return counts;
}

/**
 * Salario esperado promedio, redondeado a 2 decimales.
 * Con un array vacío retorna 0 (evita la división por cero).
 */
export function calculateAverageSalary(candidates: Candidate[]): number {
  if (candidates.length === 0) return 0;

  const total = candidates.reduce(
    (sum, candidate) => sum + candidate.expectedSalary,
    0,
  );

  return roundToTwoDecimals(total / candidates.length);
}

/** Años de experiencia promedio, redondeado a 2 decimales. 0 si no hay datos. */
export function calculateAverageExperience(candidates: Candidate[]): number {
  if (candidates.length === 0) return 0;

  const total = candidates.reduce(
    (sum, candidate) => sum + candidate.yearsOfExperience,
    0,
  );

  return roundToTwoDecimals(total / candidates.length);
}

/** Candidato con el salario esperado más alto, o `null` si la lista está vacía. */
export function findHighestPaidCandidate(
  candidates: Candidate[],
): Candidate | null {
  return candidates.reduce<Candidate | null>(
    (highest, candidate) =>
      highest === null || candidate.expectedSalary > highest.expectedSalary
        ? candidate
        : highest,
    null,
  );
}

/** Candidato con el salario esperado más bajo, o `null` si la lista está vacía. */
export function findLowestPaidCandidate(
  candidates: Candidate[],
): Candidate | null {
  return candidates.reduce<Candidate | null>(
    (lowest, candidate) =>
      lowest === null || candidate.expectedSalary < lowest.expectedSalary
        ? candidate
        : lowest,
    null,
  );
}

/**
 * Las `topN` habilidades más frecuentes entre los candidatos, de mayor a menor.
 * El conteo es case-insensitive; se conserva la primera grafía encontrada.
 * Retorna un array vacío si `topN` es <= 0 o no hay candidatos.
 */
export function findTopSkills(
  candidates: Candidate[],
  topN: number,
): SkillCount[] {
  if (topN <= 0) return [];

  const counts = new Map<string, number>();
  const displayNames = new Map<string, string>();

  for (const candidate of candidates) {
    // Un candidato aporta como máximo 1 al conteo de cada habilidad.
    const uniqueSkills = new Set(candidate.skills.map(normalizeSkill));

    for (const skill of candidate.skills) {
      const key = normalizeSkill(skill);
      if (!displayNames.has(key)) displayNames.set(key, skill.trim());
    }

    for (const key of uniqueSkills) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([key, count]) => ({ skill: displayNames.get(key) ?? key, count }))
    .sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill))
    .slice(0, topN);
}

/**
 * Porcentaje de procesos que terminaron en "Hired" (0-100, 2 decimales).
 * Con una lista vacía retorna 0.
 */
export function calculateVacancyFillRate(
  processes: SelectionProcess[],
): number {
  if (processes.length === 0) return 0;

  const hired = processes.filter(
    (process) => process.stage === "Hired",
  ).length;

  return roundToTwoDecimals((hired / processes.length) * 100);
}
