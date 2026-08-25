/**
 * Nexova — Búsquedas sobre la base de talento.
 *
 * Búsqueda lineal O(n) para colecciones sin orden garantizado y búsqueda
 * binaria O(log n) para colecciones previamente ordenadas por salario.
 */

import type { Candidate } from "../types/models.js";

/**
 * Búsqueda lineal por ID exacto.
 * Retorna `null` si el array está vacío o el ID no existe.
 */
export function findCandidateById(
  candidates: Candidate[],
  id: string,
): Candidate | null {
  for (const candidate of candidates) {
    if (candidate.id === id) return candidate;
  }
  return null;
}

/**
 * Búsqueda lineal por email, ignorando mayúsculas/minúsculas y espacios.
 * Retorna `null` si no hay coincidencia.
 */
export function findCandidateByEmail(
  candidates: Candidate[],
  email: string,
): Candidate | null {
  const target = email.trim().toLowerCase();
  if (target === "") return null;

  for (const candidate of candidates) {
    if (candidate.email.trim().toLowerCase() === target) return candidate;
  }
  return null;
}

/**
 * Búsqueda binaria sobre candidatos YA ordenados por `expectedSalary` ascendente.
 *
 * @returns índice del candidato con el salario objetivo, o -1 si no existe.
 *          Si varios candidatos comparten el salario, retorna cualquiera válido.
 */
export function binarySearchCandidateBySalary(
  sortedCandidates: Candidate[],
  targetSalary: number,
): number {
  let low = 0;
  let high = sortedCandidates.length - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const current = sortedCandidates[middle];

    // Guarda defensiva: el índice siempre es válido dentro del rango [low, high].
    if (current === undefined) return -1;

    if (current.expectedSalary === targetSalary) return middle;

    if (current.expectedSalary < targetSalary) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return -1;
}

/**
 * Variante de la búsqueda binaria que retorna el candidato en lugar del índice.
 * Retorna `null` cuando no hay coincidencia.
 */
export function binarySearchCandidateBySalaryValue(
  sortedCandidates: Candidate[],
  targetSalary: number,
): Candidate | null {
  const index = binarySearchCandidateBySalary(sortedCandidates, targetSalary);
  return index === -1 ? null : (sortedCandidates[index] ?? null);
}

/**
 * Búsqueda lineal por coincidencia parcial en el nombre completo.
 * Retorna todos los candidatos cuyo nombre contiene el texto buscado.
 */
export function searchCandidatesByName(
  candidates: Candidate[],
  query: string,
): Candidate[] {
  const target = query.trim().toLowerCase();
  if (target === "") return [];

  return candidates.filter((candidate) =>
    candidate.fullName.toLowerCase().includes(target),
  );
}
