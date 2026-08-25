import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  sampleCandidates,
  sampleVacancy,
  type Candidate,
  type SelectionProcess,
} from "../types/models.js";
import {
  calculateAverageExperience,
  calculateAverageSalary,
  calculateCandidateScore,
  calculateVacancyFillRate,
  countCandidatesByStatus,
  findHighestPaidCandidate,
  findLowestPaidCandidate,
  findTopSkills,
  groupCandidatesBySeniority,
  rankCandidatesForVacancy,
  scoreEnglishMatch,
  scoreExperienceMatch,
  scoreSalaryMatch,
  scoreSeniorityMatch,
  scoreSkillsMatch,
} from "../utils/transformations.js";

const [maria, juan, carolina] = sampleCandidates as [
  Candidate,
  Candidate,
  Candidate,
];

const buildProcess = (
  id: string,
  stage: SelectionProcess["stage"],
): SelectionProcess => ({
  id,
  candidateId: "C-2024-0451",
  vacancyId: "V-2024-0892",
  stage,
  score: 80,
  notes: "",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-02-01"),
});

describe("scoreSkillsMatch (0-40)", () => {
  it("40 puntos con todas las habilidades requeridas", () => {
    assert.equal(scoreSkillsMatch(maria, sampleVacancy), 40);
  });

  it("20 base + 20 de preferidas, limitado a 40", () => {
    assert.equal(scoreSkillsMatch(carolina, sampleVacancy), 40);
  });

  it("0 puntos con menos del 50% de las requeridas", () => {
    assert.equal(scoreSkillsMatch(juan, sampleVacancy), 0);
  });

  it("0 puntos sin habilidades declaradas", () => {
    assert.equal(scoreSkillsMatch({ ...maria, skills: [] }, sampleVacancy), 0);
  });
});

describe("scoreExperienceMatch (0-20)", () => {
  it("20 dentro del rango", () => {
    assert.equal(scoreExperienceMatch(maria, sampleVacancy), 20);
  });

  it("20 en los bordes del rango", () => {
    assert.equal(
      scoreExperienceMatch({ ...maria, yearsOfExperience: 4 }, sampleVacancy),
      20,
    );
    assert.equal(
      scoreExperienceMatch({ ...maria, yearsOfExperience: 8 }, sampleVacancy),
      20,
    );
  });

  it("10 hasta 2 años fuera del rango", () => {
    assert.equal(scoreExperienceMatch(juan, sampleVacancy), 10);
    assert.equal(
      scoreExperienceMatch({ ...maria, yearsOfExperience: 10 }, sampleVacancy),
      10,
    );
  });

  it("0 a más de 2 años del rango", () => {
    assert.equal(
      scoreExperienceMatch({ ...maria, yearsOfExperience: 1 }, sampleVacancy),
      0,
    );
    assert.equal(
      scoreExperienceMatch({ ...maria, yearsOfExperience: 11 }, sampleVacancy),
      0,
    );
  });
});

describe("scoreSeniorityMatch (0-15)", () => {
  it("15 por match exacto", () => {
    assert.equal(scoreSeniorityMatch(carolina, sampleVacancy), 15);
  });

  it("7 a un nivel de distancia", () => {
    assert.equal(scoreSeniorityMatch(maria, sampleVacancy), 7);
    assert.equal(
      scoreSeniorityMatch({ ...maria, seniority: "Lead" }, sampleVacancy),
      7,
    );
  });

  it("0 a dos o más niveles", () => {
    assert.equal(scoreSeniorityMatch(juan, sampleVacancy), 0);
  });
});

describe("scoreEnglishMatch (0-15)", () => {
  it("15 si cumple exactamente el nivel", () => {
    assert.equal(scoreEnglishMatch(maria, sampleVacancy), 15);
  });

  it("15 si lo excede", () => {
    assert.equal(scoreEnglishMatch(carolina, sampleVacancy), 15);
  });

  it("0 si no lo alcanza", () => {
    assert.equal(scoreEnglishMatch(juan, sampleVacancy), 0);
  });
});

describe("scoreSalaryMatch (0-10)", () => {
  it("10 dentro del rango", () => {
    assert.equal(scoreSalaryMatch(carolina, sampleVacancy), 10);
  });

  it("10 por debajo del mínimo (cabe en el presupuesto)", () => {
    assert.equal(scoreSalaryMatch(juan, sampleVacancy), 10);
  });

  it("5 hasta 20% sobre el máximo", () => {
    assert.equal(
      scoreSalaryMatch({ ...maria, expectedSalary: 8400 }, sampleVacancy),
      5,
    );
  });

  it("0 a más del 20% sobre el máximo", () => {
    assert.equal(
      scoreSalaryMatch({ ...maria, expectedSalary: 8401 }, sampleVacancy),
      0,
    );
  });
});

describe("calculateCandidateScore", () => {
  it("calcula el puntaje total esperado de cada candidato", () => {
    assert.equal(calculateCandidateScore(carolina, sampleVacancy), 100);
    assert.equal(calculateCandidateScore(maria, sampleVacancy), 92);
    assert.equal(calculateCandidateScore(juan, sampleVacancy), 20);
  });

  it("nunca sale del rango 0-100", () => {
    for (const candidate of sampleCandidates) {
      const score = calculateCandidateScore(candidate, sampleVacancy);
      assert.ok(score >= 0 && score <= 100);
    }
  });
});

describe("rankCandidatesForVacancy", () => {
  it("ordena de mayor a menor puntaje", () => {
    const ranking = rankCandidatesForVacancy(sampleCandidates, sampleVacancy);
    assert.deepEqual(
      ranking.map((r) => r.candidate.fullName),
      ["Carolina Silva", "María González", "Juan Pérez"],
    );
    assert.deepEqual(
      ranking.map((r) => r.score),
      [100, 92, 20],
    );
  });

  it("retorna array vacío sin candidatos", () => {
    assert.deepEqual(rankCandidatesForVacancy([], sampleVacancy), []);
  });

  it("no muta el array original", () => {
    const original = sampleCandidates.map((c) => c.id);
    rankCandidatesForVacancy(sampleCandidates, sampleVacancy);
    assert.deepEqual(
      sampleCandidates.map((c) => c.id),
      original,
    );
  });
});

describe("groupCandidatesBySeniority", () => {
  it("agrupa e incluye todos los niveles, incluso vacíos", () => {
    const groups = groupCandidatesBySeniority(sampleCandidates);
    assert.deepEqual(Object.keys(groups), [
      "Junior",
      "Semi-Senior",
      "Senior",
      "Lead",
      "Executive",
    ]);
    assert.equal(groups.Senior.length, 1);
    assert.deepEqual(groups.Lead, []);
  });
});

describe("countCandidatesByStatus", () => {
  it("cuenta por estado e incluye los estados sin candidatos", () => {
    assert.deepEqual(countCandidatesByStatus(sampleCandidates), {
      Active: 3,
      "In process": 0,
      Hired: 0,
      Inactive: 0,
    });
  });

  it("todos en cero con una colección vacía", () => {
    assert.deepEqual(countCandidatesByStatus([]), {
      Active: 0,
      "In process": 0,
      Hired: 0,
      Inactive: 0,
    });
  });
});

describe("promedios", () => {
  it("calcula el salario promedio", () => {
    assert.equal(calculateAverageSalary(sampleCandidates), 4500);
  });

  it("redondea a 2 decimales", () => {
    const candidates = [
      { ...maria, expectedSalary: 1000 },
      { ...juan, expectedSalary: 1000 },
      { ...carolina, expectedSalary: 1001 },
    ];
    assert.equal(calculateAverageSalary(candidates), 1000.33);
  });

  it("retorna 0 con una colección vacía (sin división por cero)", () => {
    assert.equal(calculateAverageSalary([]), 0);
    assert.equal(calculateAverageExperience([]), 0);
  });

  it("calcula la experiencia promedio", () => {
    assert.equal(calculateAverageExperience(sampleCandidates), 5.33);
  });
});

describe("máximos y mínimos", () => {
  it("encuentra el salario más alto y el más bajo", () => {
    assert.equal(
      findHighestPaidCandidate(sampleCandidates)?.fullName,
      "Carolina Silva",
    );
    assert.equal(
      findLowestPaidCandidate(sampleCandidates)?.fullName,
      "Juan Pérez",
    );
  });

  it("retorna null con una colección vacía", () => {
    assert.equal(findHighestPaidCandidate([]), null);
    assert.equal(findLowestPaidCandidate([]), null);
  });
});

describe("findTopSkills", () => {
  it("retorna las N habilidades más frecuentes", () => {
    const top = findTopSkills(sampleCandidates, 3);
    assert.equal(top.length, 3);
    assert.deepEqual(top, [
      { skill: "Node.js", count: 2 },
      { skill: "PostgreSQL", count: 2 },
      { skill: "React", count: 2 },
    ]);
  });

  it("cuenta ignorando mayúsculas y no duplica por candidato", () => {
    const candidates = [
      { ...maria, skills: ["React", "react", "REACT"] },
      { ...juan, skills: ["react"] },
    ];
    assert.deepEqual(findTopSkills(candidates, 1), [
      { skill: "React", count: 2 },
    ]);
  });

  it("retorna vacío con topN <= 0 o sin candidatos", () => {
    assert.deepEqual(findTopSkills(sampleCandidates, 0), []);
    assert.deepEqual(findTopSkills(sampleCandidates, -1), []);
    assert.deepEqual(findTopSkills([], 5), []);
  });

  it("no falla si topN excede la cantidad de habilidades", () => {
    assert.ok(findTopSkills(sampleCandidates, 100).length <= 100);
  });
});

describe("calculateVacancyFillRate", () => {
  it("calcula el porcentaje de contratados a 2 decimales", () => {
    const processes = [
      buildProcess("SP-1", "Hired"),
      buildProcess("SP-2", "Rejected"),
      buildProcess("SP-3", "Offer"),
    ];
    assert.equal(calculateVacancyFillRate(processes), 33.33);
  });

  it("retorna 100 si todos fueron contratados", () => {
    assert.equal(calculateVacancyFillRate([buildProcess("SP-1", "Hired")]), 100);
  });

  it("retorna 0 con una lista vacía", () => {
    assert.equal(calculateVacancyFillRate([]), 0);
  });
});
