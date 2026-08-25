import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { sampleCandidates } from "../types/models.js";
import { sortCandidatesBySalary } from "../utils/collections.js";
import {
  binarySearchCandidateBySalary,
  binarySearchCandidateBySalaryValue,
  findCandidateByEmail,
  findCandidateById,
  searchCandidatesByName,
} from "../utils/search.js";

const sortedBySalary = sortCandidatesBySalary(sampleCandidates, "asc");

describe("findCandidateById (búsqueda lineal)", () => {
  it("encuentra el candidato por ID exacto", () => {
    const found = findCandidateById(sampleCandidates, "C-2024-0453");
    assert.equal(found?.fullName, "Carolina Silva");
  });

  it("retorna null si el ID no existe", () => {
    assert.equal(findCandidateById(sampleCandidates, "C-9999-9999"), null);
  });

  it("retorna null con una colección vacía", () => {
    assert.equal(findCandidateById([], "C-2024-0451"), null);
  });
});

describe("findCandidateByEmail (búsqueda lineal)", () => {
  it("encuentra el candidato ignorando mayúsculas", () => {
    const found = findCandidateByEmail(
      sampleCandidates,
      "JUAN.PEREZ@EMAIL.COM",
    );
    assert.equal(found?.fullName, "Juan Pérez");
  });

  it("ignora espacios sobrantes", () => {
    const found = findCandidateByEmail(
      sampleCandidates,
      "  maria.gonzalez@email.com  ",
    );
    assert.equal(found?.id, "C-2024-0451");
  });

  it("retorna null si el email no existe", () => {
    assert.equal(findCandidateByEmail(sampleCandidates, "nadie@email.com"), null);
  });

  it("retorna null con un email vacío", () => {
    assert.equal(findCandidateByEmail(sampleCandidates, "   "), null);
  });
});

describe("binarySearchCandidateBySalary (búsqueda binaria)", () => {
  it("encuentra el índice de cada salario presente", () => {
    assert.equal(binarySearchCandidateBySalary(sortedBySalary, 2800), 0);
    assert.equal(binarySearchCandidateBySalary(sortedBySalary, 4200), 1);
    assert.equal(binarySearchCandidateBySalary(sortedBySalary, 6500), 2);
  });

  it("retorna -1 si el salario no existe", () => {
    assert.equal(binarySearchCandidateBySalary(sortedBySalary, 9999), -1);
    assert.equal(binarySearchCandidateBySalary(sortedBySalary, 1), -1);
  });

  it("retorna -1 con un array vacío", () => {
    assert.equal(binarySearchCandidateBySalary([], 4200), -1);
  });

  it("funciona con un solo elemento", () => {
    const single = sortedBySalary.slice(0, 1);
    assert.equal(binarySearchCandidateBySalary(single, 2800), 0);
    assert.equal(binarySearchCandidateBySalary(single, 2801), -1);
  });

  it("retorna un índice válido cuando hay salarios repetidos", () => {
    const first = sortedBySalary[0];
    assert.ok(first);
    const withDuplicates = [first, first, first];
    const index = binarySearchCandidateBySalary(withDuplicates, 2800);
    assert.ok(index >= 0 && index < withDuplicates.length);
  });

  it("la variante por valor retorna el candidato o null", () => {
    assert.equal(
      binarySearchCandidateBySalaryValue(sortedBySalary, 6500)?.fullName,
      "Carolina Silva",
    );
    assert.equal(binarySearchCandidateBySalaryValue(sortedBySalary, 1), null);
  });
});

describe("searchCandidatesByName", () => {
  it("encuentra por coincidencia parcial", () => {
    const result = searchCandidatesByName(sampleCandidates, "silva");
    assert.deepEqual(
      result.map((c) => c.fullName),
      ["Carolina Silva"],
    );
  });

  it("retorna vacío con una búsqueda en blanco", () => {
    assert.deepEqual(searchCandidatesByName(sampleCandidates, "  "), []);
  });
});
