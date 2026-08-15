import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { sampleCandidates } from "../types/models.js";
import {
  filterCandidatesByAvailability,
  filterCandidatesByRemotePreference,
  filterCandidatesBySeniority,
  filterCandidatesBySkills,
  sortCandidatesByExperience,
  sortCandidatesByName,
  sortCandidatesBySalary,
} from "../utils/collections.js";

const names = (list: { fullName: string }[]): string[] =>
  list.map((c) => c.fullName);

describe("filterCandidatesBySkills", () => {
  it("retorna solo candidatos con TODAS las habilidades requeridas", () => {
    const result = filterCandidatesBySkills(sampleCandidates, [
      "TypeScript",
      "React",
    ]);
    assert.deepEqual(names(result), ["María González"]);
  });

  it("hace matching case-insensitive", () => {
    const result = filterCandidatesBySkills(sampleCandidates, [
      "typescript",
      "NODE.JS",
    ]);
    assert.deepEqual(names(result), ["María González", "Carolina Silva"]);
  });

  it("no filtra nada si la lista de habilidades está vacía", () => {
    assert.equal(
      filterCandidatesBySkills(sampleCandidates, []).length,
      sampleCandidates.length,
    );
  });

  it("retorna array vacío si ningún candidato cumple", () => {
    assert.deepEqual(filterCandidatesBySkills(sampleCandidates, ["COBOL"]), []);
  });

  it("maneja una colección vacía", () => {
    assert.deepEqual(filterCandidatesBySkills([], ["React"]), []);
  });
});

describe("filterCandidatesBySeniority", () => {
  it("retorna candidatos del nivel exacto", () => {
    assert.deepEqual(
      names(filterCandidatesBySeniority(sampleCandidates, "Senior")),
      ["Carolina Silva"],
    );
  });

  it("retorna vacío para un nivel sin candidatos", () => {
    assert.deepEqual(filterCandidatesBySeniority(sampleCandidates, "Lead"), []);
  });
});

describe("filterCandidatesByAvailability", () => {
  it("acepta cualquiera de los estados indicados", () => {
    const result = filterCandidatesByAvailability(sampleCandidates, [
      "Immediate",
      "2 weeks",
    ]);
    assert.deepEqual(names(result), ["Juan Pérez", "Carolina Silva"]);
  });

  it("retorna vacío si no se indica ningún estado", () => {
    assert.deepEqual(filterCandidatesByAvailability(sampleCandidates, []), []);
  });
});

describe("filterCandidatesByRemotePreference", () => {
  it("una vacante remota admite a todos", () => {
    assert.equal(
      filterCandidatesByRemotePreference(sampleCandidates, true).length,
      3,
    );
  });

  it("una vacante presencial excluye a los remoteOnly", () => {
    const result = filterCandidatesByRemotePreference(sampleCandidates, false);
    assert.deepEqual(names(result), ["María González", "Carolina Silva"]);
  });
});

describe("ordenamientos", () => {
  it("ordena por salario ascendente", () => {
    const result = sortCandidatesBySalary(sampleCandidates, "asc");
    assert.deepEqual(
      result.map((c) => c.expectedSalary),
      [2800, 4200, 6500],
    );
  });

  it("ordena por salario descendente", () => {
    const result = sortCandidatesBySalary(sampleCandidates, "desc");
    assert.deepEqual(
      result.map((c) => c.expectedSalary),
      [6500, 4200, 2800],
    );
  });

  it("ordena por experiencia ascendente", () => {
    const result = sortCandidatesByExperience(sampleCandidates, "asc");
    assert.deepEqual(
      result.map((c) => c.yearsOfExperience),
      [3, 5, 8],
    );
  });

  it("ordena por nombre respetando acentos del español", () => {
    const result = sortCandidatesByName(sampleCandidates, "asc");
    assert.deepEqual(names(result), [
      "Carolina Silva",
      "Juan Pérez",
      "María González",
    ]);
  });

  it("NO muta el array original", () => {
    const original = sampleCandidates.map((c) => c.expectedSalary);
    sortCandidatesBySalary(sampleCandidates, "desc");
    sortCandidatesByExperience(sampleCandidates, "desc");
    sortCandidatesByName(sampleCandidates, "desc");
    assert.deepEqual(
      sampleCandidates.map((c) => c.expectedSalary),
      original,
    );
  });

  it("maneja colecciones vacías", () => {
    assert.deepEqual(sortCandidatesBySalary([], "asc"), []);
  });
});
