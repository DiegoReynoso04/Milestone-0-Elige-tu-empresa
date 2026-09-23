# Progress — Nexova Monorepo

Estado vivo del proyecto. Cada entrada nueva se añade **arriba**, con fecha, y se corrige (no solo se acumula) si contradice el estado actual del repo. Ver skill `.agents/skills/memory-bank-sync/SKILL.md`.

---

## 2026-09-22 — Procesador de reportes de incidentes, Fase 1: núcleo + CLI

**Estado: Fase 1 implementada y con tests en verde — aceptación contra el dataset real PENDIENTE (el CSV no está disponible).** Rama de trabajo de todo el proyecto (Fases 1–3): `feature/incident-analyzer`.

Contexto: Roberto Díaz (Customer Support Lead) necesita analizar un mes de tickets del helpdesk legado sin enviar los datos a herramientas de IA externas (el CSV contiene emails reales). Fuente de verdad: `docs/COMPANY_INCIDENT_FILE_ANALIZER_PROJECT.md`. Plan en 4 fases: 1) núcleo + CLI, 2) API, 3) frontend en backoffice, 4) integración. **Solo la Fase 1 está hecha.**

**Decisiones fijadas por el tech lead antes de implementar (D1–D9):** `invalid_records` cuenta filas distintas y el desglose cuenta activaciones de regla (D1); la consola muestra las 7 reglas aunque valgan 0 (D2); solo las 7 reglas del contexto invalidan — `ticket_id`/`date`/`status` fuera de formato no, y sin sección de warnings (D3); score presente no entero 1–5 → "fuera de rango", score válido en OPEN/DISCARDED permitido pero fuera del índice (D4); `strip()` + valores exactos, `agent_id` `^AGT-\d{2}$`, email = no vacío y con `@` (D5); `results.csv` en formato `metric,value` sin datos de registros (D6); tests solo con `unittest` (D7); núcleo en `packages/incident-analyzer/`, CLI fina en `scripts/analyze.py` (D8); el documento de contexto se queda en `docs/` (D9).

**Archivos añadidos:** `packages/incident-analyzer/` (`pyproject.toml`, `README.md`, `incident_analyzer/{__init__,schema,reader,validation,metrics,analyze,report,export}.py`, `tests/` con 8 módulos de test + `fixtures/incidents-synthetic.csv`); `scripts/analyze.py`.
**Archivos modificados:** `.gitignore` (Python + `data/raw/incidents/` + `results.csv`); `AGENTS.md` (§4: comando de validación del subproyecto); `memory-bank/{progress,techContext,projectbrief}.md`. Se versiona también `docs/COMPANY_INCIDENT_FILE_ANALIZER_PROJECT.md` (fuente funcional, sin PII).
**Sin cambios:** `services/` (no se creó), `uis/*`, `src/`. Ninguna dependencia añadida.

**Validación ejecutada:** `python -m unittest discover -s packages/incident-analyzer/tests -t packages/incident-analyzer` → 99 tests, 92 OK + 7 skipped (el test de aceptación `tests/test_acceptance.py`, marcado "PENDING" porque falta el dataset real). CLI ejecutada contra el fixture en modo interactivo (`y` → `results.csv`), `--export`, `--no-export` y con consola cp1252 (variante ASCII). **Los números 100/96/4 del contexto NO están verificados contra datos reales**: solo se comprobó, con un CSV simulado fuera del repo, que el test de aceptación y la aritmética del documento (media 215/56 = 3.84, porcentajes) son coherentes.

**Pendiente:**
- Obtener `incidents-nexova.csv`, colocarlo en `data/raw/incidents/` (ignorado por git) y ejecutar el test de aceptación.
- Criterios derivados de D4/D5 que API y frontend deben heredar sin reimplementar (reutilizando `incident_analyzer`): `+4`/`4.0` → score fuera de rango; `closed` en minúsculas no es `CLOSED` (fila válida, sin regla 6); un status desconocido deja el desglose por estado por debajo del total de válidos.
- Fases 2–4 (API, frontend, integración): **no iniciadas ni diseñadas en detalle**; requieren autorización de dependencias y levantar la decisión "`/services` no se crea".

---

## 2026-09-20 — Propuesta de arquitectura del backend (`docs/ARCHITECTURE_PROPOSAL.md`)

**Estado: hecho (documento redactado y revisado) — pendiente de aprobación del CTO (Sergio Molina).**

Contexto: el CTO pidió una propuesta razonada de arquitectura para el primer backend propio de Nexova **antes** de implementarlo. Entregable exclusivamente documental.

**Archivos añadidos:** `docs/ARCHITECTURE_PROPOSAL.md` (patrón arquitectónico, dominios, estructura de carpetas, capas, routers, versionado, frontend/backend, CORS, persistencia, configuración, testing, riesgos, decisiones propuestas vs pendientes; referencias a documentación oficial de FastAPI, Next.js y MDN).
**Archivos modificados:** `memory-bank/progress.md` (esta entrada) y `memory-bank/techContext.md` (una nota de referencia bajo la decisión "`/services` no se crea", que sigue vigente).
**Sin cambios:** ningún archivo de implementación; `services/api/` **no** se creó; ninguna dependencia añadida; FastAPI **no** instalado; `uis/*` y `src/` intactos. **Sin impacto técnico.**

**Qué contiene la propuesta (resumen, no decisiones aprobadas):** un único servicio FastAPI en `services/api/` como monolito modular por dominios con capas internas (router → service → domain → repository); módulos MVP `candidates`, `vacancies`, `pipeline` (con notas) y `matching` como capacidad interna; versionado `/api/v1`; CORS con orígenes explícitos por entorno; PostgreSQL como motor recomendado; los 97 tests de `src/` como especificación del módulo `matching`. Todo lo anterior es **[PROPUESTA]** hasta que el CTO lo apruebe; las decisiones abiertas (autenticación, ORM, hosting, vocabulario de etapas del pipeline, exposición HTTP de `matching`, revisión de privacidad, integración del website estático) están listadas en la §19 del documento y **no** deben tratarse como resueltas.

**Validación ejecutada:** `docs/` no tiene comando de validación en la tabla de `AGENTS.md` §4 (cambio solo documental). Se verificó manualmente: (a) que todas las rutas del repositorio citadas en el documento y en `memory-bank/` existen; (b) `git status --short` / `git diff --stat` muestran únicamente los archivos listados arriba; (c) fidelidad al contexto: todos los datos de Nexova citados proceden de `contexts/CONTEXT.md` / `memory-bank/projectbrief.md`.

**Siguiente paso si se aprueba:** redactar `services/api/SPECS.md` (contrato de `candidates` y `vacancies` primero) y solo después crear el servicio, añadiendo su comando de validación a la tabla de `AGENTS.md` §4 en el mismo cambio. Ver "Próximos pasos conocidos" abajo.

---

## 2026-09-14 — Monorepo AI Setup: memory-bank, AGENTS.md, .agents/, uis/backoffice

**Estado: hecho.**

Contexto: el tech lead detectó que el repo no tenía contexto persistente para agentes. Se añadió banco de memoria (`memory-bank/`), flujo de entrega obligatorio (`AGENTS.md`), reglas y skill (`.agents/`), y un scaffold real (no solo placeholder) para `uis/backoffice`.

**Archivos añadidos:** `memory-bank/{projectbrief,techContext,progress}.md`; `AGENTS.md` (raíz); `.agents/rules/{monorepo-structure,nexova-context,app-specific-overrides}.md`; `.agents/skills/memory-bank-sync/SKILL.md`; `uis/backoffice/` completo (Next.js 16 + React 19 + TS, `lib/company.ts` con datos reales de Nexova, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, config estándar, `README.md`, `CLAUDE.md`).
**Archivos modificados:** `uis/README.md` y `uis/README.es.md` (catálogo de apps existentes, incluyendo `backoffice`).
**Sin cambios:** `uis/website/` (cero diff, confirmado); `/services` (no se creó, decisión documentada en `techContext.md`); ninguna rama existente tocada.

**Validación ejecutada:** `npm install`, `npx tsc --noEmit` (limpio), `npm run lint` (limpio), `npm run build` (compila y genera `/` estático) y `npm run dev` + verificación visual en el navegador — la ficha de `NEXOVA_COMPANY` (fundación 2011, CEO Laura Mendoza, sede Valencia + oficina Miami, 120 empleados, ~8.000.000 US$, tres líneas de negocio) se renderiza correctamente, todas dentro de `uis/backoffice/`.

**Hallazgo relevante durante la implementación:** `contexts/` está en `.gitignore` (raíz, línea 8) — nunca ha estado en git (`git ls-files contexts/` vacío). No viaja con el repositorio; solo existe en checkouts locales que ya la tenían. Se ajustó toda la documentación nueva para que `memory-bank/projectbrief.md` sea la referencia de negocio válida para quien clone el repo sin esa carpeta, y para que `contexts/CONTEXT.md` se cite como fuente ampliada "si está disponible localmente", nunca como algo garantizado.

**Desviación respecto a la rama planeada inicialmente:** el plan original (antes de corrección) proponía ramificar desde `feature/talent-pipeline-tracker` y abrir el PR contra esa misma rama, asumiendo que `main` no tenía Hitos 2/3. La inspección real mostró que el `main` **local** estaba desactualizado: `origin/main` ya tenía Hitos 2 y 3 mergeados (PRs #1, #2, #3). Corregido a petición del tech lead: rama `feature/agent-memory-bank` creada desde `origin/main`, PR con base `main` — sin tocar ninguna rama existente.

---

## Hito 3 — Talent Pipeline Tracker (`uis/talent-pipeline-tracker/`)

**Estado: hecho, mergeado a `main`** (PR #2 `Inicializar proyecto...`, PR #3 `feat: completar Talent Pipeline Tracker`).

Panel interno de gestión de candidaturas para Operaciones de Selección (Javier Almeida) / encargo urgente de Elena Vargas (L&D), con copia a Sergio Molina (CTO). Next.js 16 + React 19 + TS estricto, consume directo la API mock externa (`playground.4geeks.com/tracker/api/v1`, CORS verificado, sin proxy). Cinco incógnitas de contrato (`SPECS.md` §0, V-1 a V-5) resueltas empíricamente antes de implementar. Fuera de alcance deliberado: eliminar candidaturas (endpoint existe en la API pero no se expone en la UI).

## Hito 2 — Modelos de dominio y scoring (`src/`)

**Estado: hecho, mergeado a `main`** (PR #1 `feature/domain-models`).

Utilidades TypeScript para el motor de scoring de candidatos y matching de vacantes de Javier Almeida (Operaciones de Selección): `Candidate`, `Vacancy`, `SelectionProcess`, funciones de filtrado/búsqueda/scoring/validación. 97 tests con el runner nativo de Node (`node:test`), sin dependencias de terceros. `npm run check` = typecheck + tests.

## Hito 1 — Sitio web público (`uis/website/`)

**Estado: hecho, desplegado en Netlify.**

Landing corporativa + formulario de registro de talento para Carmen Ruiz (Marketing y Comunicación). HTML estático + Tailwind CSS v4 (Play CDN), Schema.org `Organization` JSON-LD, accesible (skip link, foco visible).

## Hito 0 — Elección de empresa

**Estado: hecho.**

Empresa elegida: **Nexova**. Justificación en `contexts/COMPANY-CHOICE.md` (local, no versionado — ver nota sobre `contexts/` en `techContext.md`); resumen de por qué en `memory-bank/projectbrief.md`.

---

## Decisiones y problemas conocidos

- **`README.md` raíz desactualizado:** describe un `CONTEXT.md` en la raíz que ya no existe (se movió a `contexts/CONTEXT.md` en el commit `9877ff6`). No se corrige en este cambio (fuera del alcance del brief actual) — `AGENTS.md` y `memory-bank/techContext.md` ya apuntan a la ruta real para que esto no bloquee a un agente.
- **`main` local puede desactualizarse silenciosamente:** al iniciar este cambio, el `main` local estaba 7 commits detrás de `origin/main` (incluía Hitos 2 y 3, ya mergeados vía PR). Cualquier agente debe `git fetch` antes de asumir en qué estado está `main`.
- **`/services` deliberadamente vacío:** ver justificación en `memory-bank/techContext.md`. Desde 2026-09-20 existe una **propuesta** de cómo debería ser ese backend (`docs/ARCHITECTURE_PROPOSAL.md`), pendiente de aprobación del CTO; la decisión de no crear `/services` sigue vigente hasta entonces.

## Próximos pasos conocidos (no implementados aquí)

- **Backend propio:** `docs/ARCHITECTURE_PROPOSAL.md` está pendiente de revisión por el CTO. Si se aprueba, el orden previsto es: `services/api/SPECS.md` (contrato) → creación del servicio → alta de su comando de validación en `AGENTS.md` §4 → registro de las decisiones aprobadas en `memory-bank/techContext.md`. Nada de esto se ha iniciado.
- **Procesador de incidentes:** Fase 1 hecha (ver entrada 2026-09-22); pendientes el test de aceptación con el CSV real y las Fases 2–4.
- `uis/backoffice` es un punto de entrada — las capacidades reales (RRHH interno, ventas, dirección ejecutiva) requieren su propio contexto de hito antes de implementarse.
