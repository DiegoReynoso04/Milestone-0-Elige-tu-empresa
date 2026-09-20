# Progress — Nexova Monorepo

Estado vivo del proyecto. Cada entrada nueva se añade **arriba**, con fecha, y se corrige (no solo se acumula) si contradice el estado actual del repo. Ver skill `.agents/skills/memory-bank-sync/SKILL.md`.

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
- `uis/backoffice` es un punto de entrada — las capacidades reales (RRHH interno, ventas, dirección ejecutiva) requieren su propio contexto de hito antes de implementarse.
