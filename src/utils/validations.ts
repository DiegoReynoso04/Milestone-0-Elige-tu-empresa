/**
 * Nexova — Validaciones de negocio.
 *
 * Se ejecutan antes de procesar o almacenar una entidad. Cada función retorna
 * la lista completa de errores encontrados (no corta en el primero) para que el
 * consultor pueda corregir todo de una sola vez.
 */

import type {
  Candidate,
  SelectionProcess,
  ValidationResult,
  Vacancy,
} from "../types/models.js";

// ---------------------------------------------------------------------------
// Reglas numéricas del dominio
// ---------------------------------------------------------------------------

const MIN_YEARS_OF_EXPERIENCE = 0;
const MAX_YEARS_OF_EXPERIENCE = 50;
const MIN_SCORE = 0;
const MAX_SCORE = 100;

// ---------------------------------------------------------------------------
// Validadores primitivos reutilizables
// ---------------------------------------------------------------------------

/**
 * Validación básica de email: exige un `@` con texto a ambos lados y un punto
 * en el dominio que no quede ni al inicio ni al final. No es de nivel producción.
 */
export function isValidEmail(email: string): boolean {
  const value = email.trim();

  const atIndex = value.indexOf("@");
  const isSingleAt = atIndex > 0 && atIndex === value.lastIndexOf("@");
  if (!isSingleAt) return false;

  const domain = value.slice(atIndex + 1);
  const dotIndex = domain.indexOf(".");

  return dotIndex > 0 && dotIndex < domain.length - 1;
}

/** True si el texto tiene contenido más allá de espacios en blanco. */
export function isNonEmptyText(value: string): boolean {
  return value.trim().length > 0;
}

/** True si el número es finito y está dentro del rango inclusivo indicado. */
export function isWithinRange(
  value: number,
  min: number,
  max: number,
): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

/** True si el número es finito y estrictamente mayor que cero. */
export function isPositiveNumber(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/** True si la fecha es un objeto Date válido (no `Invalid Date`). */
export function isValidDate(date: Date): boolean {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

// ---------------------------------------------------------------------------
// Validadores de entidades
// ---------------------------------------------------------------------------

/**
 * Valida las reglas de negocio de un candidato.
 * - Identidad: id, nombre y teléfono no vacíos; email con formato válido.
 * - Experiencia entre 0 y 50 años.
 * - Salarios actual y esperado mayores que 0.
 * - Al menos una habilidad declarada.
 */
export function validateCandidate(candidate: Candidate): ValidationResult {
  const errors: string[] = [];

  if (!isNonEmptyText(candidate.id)) {
    errors.push("El ID del candidato es obligatorio.");
  }

  if (!isNonEmptyText(candidate.fullName)) {
    errors.push("El nombre completo es obligatorio.");
  }

  if (!isValidEmail(candidate.email)) {
    errors.push(`El email "${candidate.email}" no tiene un formato válido.`);
  }

  if (!isNonEmptyText(candidate.phone)) {
    errors.push("El teléfono de contacto es obligatorio.");
  }

  if (
    !isWithinRange(
      candidate.yearsOfExperience,
      MIN_YEARS_OF_EXPERIENCE,
      MAX_YEARS_OF_EXPERIENCE,
    )
  ) {
    errors.push(
      `Los años de experiencia deben estar entre ${MIN_YEARS_OF_EXPERIENCE} y ${MAX_YEARS_OF_EXPERIENCE}.`,
    );
  }

  if (candidate.skills.length === 0) {
    errors.push("El candidato debe tener al menos 1 habilidad.");
  }

  if (!isPositiveNumber(candidate.currentSalary)) {
    errors.push("El salario actual debe ser mayor que 0.");
  }

  if (!isPositiveNumber(candidate.expectedSalary)) {
    errors.push("El salario esperado debe ser mayor que 0.");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valida las reglas de negocio de una vacante.
 * - Identidad: id, título y empresa cliente no vacíos.
 * - Al menos una habilidad requerida.
 * - Rango de experiencia coherente y no negativo.
 * - Rango salarial coherente y con ambos extremos mayores que 0.
 */
export function validateVacancy(vacancy: Vacancy): ValidationResult {
  const errors: string[] = [];

  if (!isNonEmptyText(vacancy.id)) {
    errors.push("El ID de la vacante es obligatorio.");
  }

  if (!isNonEmptyText(vacancy.title)) {
    errors.push("El título del puesto es obligatorio.");
  }

  if (!isNonEmptyText(vacancy.companyName)) {
    errors.push("El nombre de la empresa cliente es obligatorio.");
  }

  if (vacancy.requiredSkills.length === 0) {
    errors.push("La vacante debe tener al menos 1 habilidad requerida.");
  }

  if (
    !Number.isFinite(vacancy.minYearsExperience) ||
    vacancy.minYearsExperience < 0
  ) {
    errors.push("La experiencia mínima no puede ser negativa.");
  }

  if (vacancy.maxYearsExperience < vacancy.minYearsExperience) {
    errors.push(
      "La experiencia máxima debe ser mayor o igual que la experiencia mínima.",
    );
  }

  if (!isPositiveNumber(vacancy.salaryRangeMin)) {
    errors.push("El salario mínimo debe ser mayor que 0.");
  }

  if (!isPositiveNumber(vacancy.salaryRangeMax)) {
    errors.push("El salario máximo debe ser mayor que 0.");
  }

  if (vacancy.salaryRangeMax < vacancy.salaryRangeMin) {
    errors.push(
      "El salario máximo debe ser mayor o igual que el salario mínimo.",
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valida un proceso de selección.
 * - Referencias a candidato y vacante presentes.
 * - Puntaje entre 0 y 100.
 * - Fechas válidas y con `updatedAt` no anterior a `createdAt`.
 */
export function validateSelectionProcess(
  process: SelectionProcess,
): ValidationResult {
  const errors: string[] = [];

  if (!isNonEmptyText(process.id)) {
    errors.push("El ID del proceso es obligatorio.");
  }

  if (!isNonEmptyText(process.candidateId)) {
    errors.push("El proceso debe referenciar a un candidato.");
  }

  if (!isNonEmptyText(process.vacancyId)) {
    errors.push("El proceso debe referenciar a una vacante.");
  }

  if (!isWithinRange(process.score, MIN_SCORE, MAX_SCORE)) {
    errors.push(`El puntaje debe estar entre ${MIN_SCORE} y ${MAX_SCORE}.`);
  }

  if (!isValidDate(process.createdAt)) {
    errors.push("La fecha de creación no es válida.");
  }

  if (!isValidDate(process.updatedAt)) {
    errors.push("La fecha de actualización no es válida.");
  }

  if (
    isValidDate(process.createdAt) &&
    isValidDate(process.updatedAt) &&
    process.updatedAt.getTime() < process.createdAt.getTime()
  ) {
    errors.push(
      "La fecha de actualización no puede ser anterior a la de creación.",
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valida una colección completa y separa las entidades aptas de las rechazadas.
 * Útil antes de una carga masiva a la base de talento.
 */
export function partitionValidCandidates(candidates: Candidate[]): {
  valid: Candidate[];
  invalid: Array<{ candidate: Candidate; errors: string[] }>;
} {
  const valid: Candidate[] = [];
  const invalid: Array<{ candidate: Candidate; errors: string[] }> = [];

  for (const candidate of candidates) {
    const result = validateCandidate(candidate);
    if (result.valid) {
      valid.push(candidate);
    } else {
      invalid.push({ candidate, errors: result.errors });
    }
  }

  return { valid, invalid };
}
