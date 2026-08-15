# Hito 2 — Fundamentos de Programación (Nexova)

Utilidades TypeScript para el motor de scoring de candidatos y matching de vacantes.

**Rama:** `feature/domain-models`

---

## Estructura

```
src/
├── types/
│   └── models.ts          # Interfaces, tipos union, escalas ordinales y datos de ejemplo
├── utils/
│   ├── collections.ts     # Filtros y ordenamientos sobre arrays
│   ├── search.ts          # Búsqueda lineal y binaria
│   ├── transformations.ts # Scoring, ranking, agrupaciones y reportes
│   └── validations.ts     # Reglas de negocio
└── tests/
    ├── collections.test.ts
    ├── search.test.ts
    ├── transformations.test.ts
    └── validations.test.ts
```

---

## Comandos

```bash
npm install          # instala TypeScript, tsx y @types/node
npm run typecheck    # valida tipos sin emitir archivos (npx tsc --noEmit)
npm test             # ejecuta los 97 tests con el runner nativo de Node
npm run check        # typecheck + tests, todo de una
npm run build        # compila a dist/
```

El comando de validación durante el desarrollo es **`npm run check`**.

Los tests usan `node:test` y `node:assert/strict` — el runner nativo de Node, sin
dependencias de terceros. `tsx` solo se encarga de ejecutar TypeScript directamente.

---

## Cómo se creó la rama

```bash
git switch -c feature/domain-models
```

---

## Configuración de TypeScript

`tsconfig.json` corre en modo `strict` con chequeos adicionales:

| Opción | Por qué |
|---|---|
| `strict` | Null safety y tipado completo |
| `noUncheckedIndexedAccess` | El acceso por índice devuelve `T \| undefined` — obliga a manejar el caso fuera de rango (clave en la búsqueda binaria) |
| `noUnusedLocals` / `noUnusedParameters` | Sin código muerto |
| `exactOptionalPropertyTypes` | `undefined` no se cuela en propiedades opcionales |
| `verbatimModuleSyntax` | Fuerza `import type` para lo que solo son tipos |

---

## API por archivo

### `src/types/models.ts`

Interfaces `Candidate`, `Vacancy`, `SelectionProcess` con tipos explícitos en cada propiedad, y los tipos union del dominio (`EnglishLevel`, `SeniorityLevel`, `AvailabilityStatus`, `CandidateStatus`, `VacancyStatus`, `ProcessStage`).

Además expone:

- `ENGLISH_LEVELS`, `SENIORITY_LEVELS`, `CANDIDATE_STATUSES` — tuplas `readonly` que definen el orden ordinal de cada escala.
- `getEnglishLevelRank()`, `getSeniorityRank()` — métodos auxiliares para comparar niveles sin duplicar literales por el código.
- `sampleCandidates`, `sampleVacancy` — objetos literales con los datos de ejemplo del contexto.

### `src/utils/collections.ts`

| Función | Retorna |
|---|---|
| `filterCandidatesBySkills(candidates, requiredSkills)` | Candidatos con **todas** las habilidades (case-insensitive) |
| `filterCandidatesBySeniority(candidates, seniority)` | Candidatos con ese seniority exacto |
| `filterCandidatesByAvailability(candidates, availability[])` | Candidatos que coinciden con alguno de los estados |
| `filterCandidatesByRemotePreference(candidates, isRemote)` | Candidatos compatibles con la modalidad de la vacante |
| `sortCandidatesBySalary(candidates, order)` | Copia ordenada por salario esperado |
| `sortCandidatesByExperience(candidates, order)` | Copia ordenada por años de experiencia |
| `sortCandidatesByName(candidates, order)` | Copia ordenada alfabéticamente (`localeCompare` con locale `es`) |

Ningún filtro ni ordenamiento muta el array recibido: los `sort` operan sobre `[...candidates]`.

### `src/utils/search.ts`

| Función | Complejidad | Retorna |
|---|---|---|
| `findCandidateById(candidates, id)` | O(n) lineal | `Candidate \| null` |
| `findCandidateByEmail(candidates, email)` | O(n) lineal, case-insensitive | `Candidate \| null` |
| `binarySearchCandidateBySalary(sorted, target)` | O(log n) binaria | índice, o `-1` |
| `binarySearchCandidateBySalaryValue(sorted, target)` | O(log n) binaria | `Candidate \| null` |
| `searchCandidatesByName(candidates, query)` | O(n) lineal | coincidencias parciales |

La búsqueda binaria **asume** el array ya ordenado por `expectedSalary` ascendente; usar `sortCandidatesBySalary(candidates, "asc")` antes de llamarla.

### `src/utils/transformations.ts`

**Scoring (0-100).** Cada dimensión está expuesta como función independiente para poder testearla y auditarla por separado:

| Dimensión | Máx | Regla |
|---|---|---|
| `scoreSkillsMatch` | 40 | 40 con todas las requeridas · 20 con ≥50% · +10 por preferida (tope +20), total limitado a 40 |
| `scoreExperienceMatch` | 20 | 20 dentro del rango · 10 hasta 2 años fuera · 0 más allá |
| `scoreSeniorityMatch` | 15 | 15 exacto · 7 a un nivel de distancia · 0 en otro caso |
| `scoreEnglishMatch` | 15 | 15 si cumple o excede el nivel requerido |
| `scoreSalaryMatch` | 10 | 10 dentro del presupuesto · 5 hasta 20% sobre el máximo · 0 más arriba |

`calculateCandidateScore(candidate, vacancy)` suma las cinco y acota el resultado a 0-100.

Agregaciones y reportes:

- `rankCandidatesForVacancy()` → `Array<{ candidate, score }>` de mayor a menor.
- `groupCandidatesBySeniority()` → `Record<SeniorityLevel, Candidate[]>` con todos los niveles presentes.
- `countCandidatesByStatus()` → `Record<CandidateStatus, number>` con todos los estados presentes.
- `calculateAverageSalary()` / `calculateAverageExperience()` → promedio a 2 decimales.
- `findHighestPaidCandidate()` / `findLowestPaidCandidate()` → máximo y mínimo, `null` si no hay datos.
- `findTopSkills(candidates, topN)` → las N habilidades más frecuentes.
- `calculateVacancyFillRate(processes)` → % de procesos en `"Hired"`, a 2 decimales.

### `src/utils/validations.ts`

Primitivos reutilizables: `isValidEmail`, `isNonEmptyText`, `isWithinRange`, `isPositiveNumber`, `isValidDate`.

Validadores de entidad, todos con la firma `{ valid: boolean, errors: string[] }`:

- `validateCandidate()` — id/nombre/teléfono no vacíos, email válido, experiencia 0-50, ≥1 habilidad, ambos salarios > 0.
- `validateVacancy()` — id/título/empresa no vacíos, ≥1 habilidad requerida, `minYearsExperience ≥ 0`, `maxYearsExperience ≥ minYearsExperience`, salarios > 0 y `salaryRangeMax ≥ salaryRangeMin`.
- `validateSelectionProcess()` — referencias presentes, `score` 0-100, fechas válidas y `updatedAt ≥ createdAt`.
- `partitionValidCandidates()` — separa una colección en aptos y rechazados con sus errores, para cargas masivas.

Los validadores **acumulan** todos los errores en lugar de cortar en el primero, para que el consultor corrija todo de una pasada.

---

## Decisiones de diseño

**Tope de habilidades en 40.** El enunciado fija el bloque de habilidades en "40 puntos máx" pero permite +40 por las requeridas y +20 por las preferidas. Se aplica el tope de 40 al total del bloque, de modo que la suma de las cinco dimensiones nunca exceda 100.

**Salario por debajo del mínimo.** Una expectativa menor a `salaryRangeMin` cabe en el presupuesto, así que puntúa 10 igual que estar dentro del rango.

**Escalas ordinales derivadas de constantes.** `ENGLISH_LEVELS` y `SENIORITY_LEVELS` son la única fuente de verdad del orden; el scoring compara índices en vez de encadenar comparaciones literales.

**Case-insensitive en habilidades y emails.** Los CVs llegan con grafías inconsistentes (`node.js`, `Node.JS`), por lo que la comparación normaliza a minúsculas y recorta espacios. `findTopSkills` agrupa por la forma normalizada pero muestra la primera grafía encontrada.

**Sin mutaciones.** Toda función que ordena copia primero; toda función que filtra devuelve un array nuevo. Ninguna lee ni escribe estado global.

**Todos los grupos y estados presentes.** `groupCandidatesBySeniority` y `countCandidatesByStatus` inicializan todas las claves del union, así el consumidor nunca recibe `undefined` al indexar.

---

## Tests

97 tests en 28 suites, ejecutables con `npm test`.

### Cómo se declara un test

Los tests usan `node:test` y `node:assert/strict`, ambos incluidos en Node — no
hay Jest, Vitest ni ninguna dependencia de terceros que mantener. Un test tiene
tres piezas:

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("calculateCandidateScore", () => {           // 1. grupo de casos
  it("calcula el puntaje total de cada candidato", () => {   // 2. un caso
    assert.equal(calculateCandidateScore(carolina, sampleVacancy), 100);
    assert.equal(calculateCandidateScore(maria, sampleVacancy), 92);
    assert.equal(calculateCandidateScore(juan, sampleVacancy), 20);
  });                                                 // 3. la comprobación
});
```

- **`describe(...)`** agrupa los casos de una misma función. Da los 28 bloques.
- **`it(...)`** describe un caso concreto en lenguaje natural. Da los 97 tests.
- **`assert.equal(recibido, esperado)`** compara. Si coinciden no pasa nada; si
  no, lanza un error con ambos valores.

### Con qué datos se ejecutan

Con candidatos ficticios reales, no con valores inventados sobre la marcha:
`sampleCandidates` y `sampleVacancy` de `src/types/models.ts`, que son los tres
candidatos (María González, Juan Pérez, Carolina Silva) y la vacante de Senior
Full-Stack Developer definidos en el documento de contexto de Nexova.

Cuando un caso necesita una variante — un salario fuera de rango, un email
malformado — parte del candidato de ejemplo y cambia solo el campo en cuestión:

```typescript
scoreSalaryMatch({ ...maria, expectedSalary: 8400 }, sampleVacancy)  // → 5
```

Así cada test aísla exactamente la regla que quiere comprobar.

### Por qué `assert` y no `console.log`

Ambos ejecutan la misma función con los mismos datos. La diferencia es quién
revisa el resultado:

| | Quién comprueba | Qué pasa si el valor cambia |
|---|---|---|
| `console.log(score)` | Tú, mirando la pantalla | Nada. Sale otro número y hay que darse cuenta |
| `assert.equal(score, 100)` | Node, automáticamente | El test falla y señala función, valor esperado y recibido |

Con `assert`, el valor correcto queda escrito en el código. Si mañana alguien
toca el scoring y Carolina pasa a sacar 87, `npm test` lo detecta sin que nadie
tenga que recordar cuál era el número bueno.

### Cómo leer la salida

```
✔ calcula el puntaje total de cada candidato (0.21ms)
✔ nunca sale del rango 0-100 (0.08ms)
...
ℹ tests 97
ℹ pass 97
ℹ fail 0
```

`fail 0` es lo único que importa. Si algo falla, el runner imprime el caso, el
valor esperado y el recibido.

`npm run typecheck` funciona al revés: **no imprime nada cuando todo está bien**.
Solo habla para reportar errores, siguiendo la convención de las herramientas de
línea de comandos. Silencio = correcto.

### Cobertura por archivo

| Suite | Qué cubre |
|---|---|
| `collections.test.ts` | Matching case-insensitive, filtros vacíos, orden asc/desc y **no mutación** del array original |
| `search.test.ts` | Lineal con y sin coincidencia, binaria en bordes, array vacío, un solo elemento y salarios duplicados |
| `transformations.test.ts` | Cada dimensión del scoring por separado, bordes de rango, ranking, agrupaciones, promedios, máx/mín y fill rate |
| `validations.test.ts` | Cada regla de negocio, bordes numéricos (0, 50, 51), emails malformados y acumulación de errores |

La estrategia es cubrir el **caso normal** y los **bordes**: colecciones vacías,
búsquedas sin resultado, valores justo dentro y justo fuera de cada rango, y la
comprobación explícita de que ordenar no muta el array original.

---

## Verificación con los datos de ejemplo

`rankCandidatesForVacancy(sampleCandidates, sampleVacancy)`:

| Candidato | Habilidades | Experiencia | Seniority | Inglés | Salario | **Total** |
|---|---|---|---|---|---|---|
| Carolina Silva | 40 (2/3 req + 2 pref, con tope) | 20 | 15 | 15 | 10 | **100** |
| María González | 40 (3/3 req) | 20 | 7 | 15 | 10 | **92** |
| Juan Pérez | 0 (1/3 req) | 10 | 0 | 0 | 10 | **20** |

Casos límite comprobados: arrays vacíos en promedios (`0`), búsquedas sin coincidencia (`null` / `-1`), búsqueda binaria sobre array vacío (`-1`), y arrays originales intactos tras ordenar.
