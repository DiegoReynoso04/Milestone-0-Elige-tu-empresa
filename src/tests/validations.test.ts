import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  sampleCandidates,
  sampleVacancy,
  type Candidate,
  type SelectionProcess,
} from "../types/models.js";
import {
  isNonEmptyText,
  isPositiveNumber,
  isValidDate,
  isValidEmail,
  isWithinRange,
  partitionValidCandidates,
  validateCandidate,
  validateSelectionProcess,
  validateVacancy,
} from "../utils/validations.js";

const [maria] = sampleCandidates as [Candidate];

const validProcess: SelectionProcess = {
  id: "SP-2024-1523",
  candidateId: "C-2024-0451",
  vacancyId: "V-2024-0892",
  stage: "Interview",
  score: 92,
  notes: "Buen perfil técnico.",
  createdAt: new Date("2024-01-10"),
  updatedAt: new Date("2024-01-20"),
};

describe("isValidEmail", () => {
  it("acepta emails con formato válido", () => {
    assert.equal(isValidEmail("maria.gonzalez@email.com"), true);
    assert.equal(isValidEmail("  a@b.co  "), true);
  });

  it("rechaza emails sin dominio con punto", () => {
    assert.equal(isValidEmail("a@b"), false);
  });

  it("rechaza emails sin parte local", () => {
    assert.equal(isValidEmail("@email.com"), false);
  });

  it("rechaza puntos al inicio o final del dominio", () => {
    assert.equal(isValidEmail("a@.com"), false);
    assert.equal(isValidEmail("a@email."), false);
  });

  it("rechaza múltiples arrobas y cadenas vacías", () => {
    assert.equal(isValidEmail("a@@email.com"), false);
    assert.equal(isValidEmail(""), false);
  });
});

describe("validadores primitivos", () => {
  it("isNonEmptyText ignora espacios", () => {
    assert.equal(isNonEmptyText("texto"), true);
    assert.equal(isNonEmptyText("   "), false);
  });

  it("isWithinRange respeta los bordes y rechaza NaN", () => {
    assert.equal(isWithinRange(0, 0, 50), true);
    assert.equal(isWithinRange(50, 0, 50), true);
    assert.equal(isWithinRange(51, 0, 50), false);
    assert.equal(isWithinRange(Number.NaN, 0, 50), false);
  });

  it("isPositiveNumber rechaza cero, negativos e infinito", () => {
    assert.equal(isPositiveNumber(1), true);
    assert.equal(isPositiveNumber(0), false);
    assert.equal(isPositiveNumber(-5), false);
    assert.equal(isPositiveNumber(Number.POSITIVE_INFINITY), false);
  });

  it("isValidDate rechaza fechas inválidas", () => {
    assert.equal(isValidDate(new Date("2024-01-01")), true);
    assert.equal(isValidDate(new Date("no es fecha")), false);
  });
});

describe("validateCandidate", () => {
  it("acepta un candidato válido sin errores", () => {
    assert.deepEqual(validateCandidate(maria), { valid: true, errors: [] });
  });

  it("rechaza experiencia negativa o mayor a 50", () => {
    assert.equal(
      validateCandidate({ ...maria, yearsOfExperience: -1 }).valid,
      false,
    );
    assert.equal(
      validateCandidate({ ...maria, yearsOfExperience: 51 }).valid,
      false,
    );
    assert.equal(
      validateCandidate({ ...maria, yearsOfExperience: 50 }).valid,
      true,
    );
  });

  it("rechaza salarios en cero o negativos", () => {
    assert.equal(validateCandidate({ ...maria, currentSalary: 0 }).valid, false);
    assert.equal(
      validateCandidate({ ...maria, expectedSalary: -100 }).valid,
      false,
    );
  });

  it("rechaza un candidato sin habilidades", () => {
    assert.equal(validateCandidate({ ...maria, skills: [] }).valid, false);
  });

  it("rechaza email inválido y teléfono vacío", () => {
    assert.equal(validateCandidate({ ...maria, email: "roto@" }).valid, false);
    assert.equal(validateCandidate({ ...maria, phone: "  " }).valid, false);
  });

  it("acumula TODOS los errores en lugar de cortar en el primero", () => {
    const result = validateCandidate({
      ...maria,
      email: "roto@",
      phone: "",
      skills: [],
      yearsOfExperience: -2,
      currentSalary: 0,
      expectedSalary: 0,
    });
    assert.equal(result.valid, false);
    assert.equal(result.errors.length, 6);
  });
});

describe("validateVacancy", () => {
  it("acepta una vacante válida sin errores", () => {
    assert.deepEqual(validateVacancy(sampleVacancy), {
      valid: true,
      errors: [],
    });
  });

  it("rechaza vacante sin habilidades requeridas", () => {
    assert.equal(
      validateVacancy({ ...sampleVacancy, requiredSkills: [] }).valid,
      false,
    );
  });

  it("rechaza experiencia mínima negativa", () => {
    assert.equal(
      validateVacancy({ ...sampleVacancy, minYearsExperience: -1 }).valid,
      false,
    );
  });

  it("rechaza rango de experiencia invertido", () => {
    const result = validateVacancy({
      ...sampleVacancy,
      minYearsExperience: 8,
      maxYearsExperience: 4,
    });
    assert.equal(result.valid, false);
  });

  it("rechaza rango salarial invertido o no positivo", () => {
    assert.equal(
      validateVacancy({
        ...sampleVacancy,
        salaryRangeMin: 7000,
        salaryRangeMax: 5000,
      }).valid,
      false,
    );
    assert.equal(
      validateVacancy({ ...sampleVacancy, salaryRangeMin: 0 }).valid,
      false,
    );
  });
});

describe("validateSelectionProcess", () => {
  it("acepta un proceso válido", () => {
    assert.equal(validateSelectionProcess(validProcess).valid, true);
  });

  it("rechaza puntajes fuera de 0-100", () => {
    assert.equal(
      validateSelectionProcess({ ...validProcess, score: 101 }).valid,
      false,
    );
    assert.equal(
      validateSelectionProcess({ ...validProcess, score: -1 }).valid,
      false,
    );
  });

  it("rechaza fechas incoherentes", () => {
    const result = validateSelectionProcess({
      ...validProcess,
      createdAt: new Date("2024-05-01"),
      updatedAt: new Date("2024-01-01"),
    });
    assert.equal(result.valid, false);
  });

  it("rechaza referencias vacías", () => {
    assert.equal(
      validateSelectionProcess({ ...validProcess, candidateId: "" }).valid,
      false,
    );
  });
});

describe("partitionValidCandidates", () => {
  it("separa aptos de rechazados con sus errores", () => {
    const roto = { ...maria, id: "C-ROTO", skills: [] };
    const result = partitionValidCandidates([...sampleCandidates, roto]);

    assert.equal(result.valid.length, 3);
    assert.equal(result.invalid.length, 1);
    assert.equal(result.invalid[0]?.candidate.id, "C-ROTO");
    assert.ok(result.invalid[0]!.errors.length > 0);
  });

  it("maneja una colección vacía", () => {
    assert.deepEqual(partitionValidCandidates([]), { valid: [], invalid: [] });
  });
});
