# Tech Context — Monorepo Nexova

Contexto **técnico**: convenciones de carpetas, stacks reales por app y decisiones de arquitectura vigentes. No repite contexto de negocio — ver `projectbrief.md` para eso.

## Convención de carpetas (definida en `README.md` raíz)

Una responsabilidad por carpeta de primer nivel: `uis/` (frontends), `services/` (backends/APIs), `data/` (raw/pipelines/process/eval), `agents/` (agentes de IA), `skills/` (capacidades reutilizables para agentes), `mcps/` (servidores MCP), `workflows/` (n8n/automatización), `packages/` (librerías compartidas), `shared/` (esquemas/plantillas sueltas), `docs/`, `infra/`, `scripts/`, `internal/`. Antes de crear una carpeta nueva de cualquier tipo, releer la tabla "¿Dónde pongo esto?" del `README.md` raíz y el `README.md` de la carpeta destino.

**Nota de ruta:** el `README.md` raíz describe un `CONTEXT.md` en la raíz del repo. Ese archivo **no existe** — se movió a `contexts/CONTEXT.md` (commit `9877ff6`, "mover notas de contexto a carpeta local `contexts/`"). El README raíz no se ha actualizado para reflejarlo.

**Importante — `contexts/` no está en git.** El `.gitignore` raíz (línea 8) ignora toda la carpeta `contexts/`: `git ls-files contexts/` no devuelve nada, y `git check-ignore -v contexts/CONTEXT.md` lo confirma. Es decir, `contexts/CONTEXT.md` y los `contexts/hitoN/*.md` **existen solo en checkouts locales que ya los tenían** (probablemente deliberado: el propio `CONTEXT.md` se marca como "Documento interno... uso exclusivo para la generación de proyectos del programa"). Alguien que clone este repositorio desde GitHub **no** obtiene esa carpeta.

**Consecuencia práctica:** `memory-bank/projectbrief.md` no es solo un resumen de comodidad — es el **único registro de contexto de negocio versionado y compartido** vía git. Cualquier instrucción que diga "leer `contexts/CONTEXT.md`" solo aplica si esa carpeta existe en el checkout local; si no existe, `memory-bank/projectbrief.md` es la referencia disponible y debe bastar por sí sola.

## Inventario de apps existentes

| App | Ruta | Stack real | Origen |
|---|---|---|---|
| Website público | `uis/website/` | HTML estático + Tailwind CSS v4 vía Play CDN (`@tailwindcss/browser@4`), sin build step, Schema.org JSON-LD | Hito 1, desplegado en Netlify (`netlify.toml` en raíz) |
| Domain models / scoring | `src/` (raíz) | TypeScript estricto (`tsconfig.json` modo `strict` + `noUncheckedIndexedAccess`), tests con `node:test` nativo (sin Jest/Vitest), ejecutados vía `tsx` | Hito 2 |
| Talent Pipeline Tracker | `uis/talent-pipeline-tracker/` | Next.js 16.3.2 (App Router) + React 19.2.8 + TypeScript estricto + Tailwind CSS v4 (`@import "tailwindcss"`, sin `tailwind.config.ts`). Solo hooks nativos de React, sin librerías de estado externas. Reglas propias detalladas en su `CLAUDE.md`/`SPECS.md` — **no duplicadas aquí, solo referenciadas** | Hito 3 |
| Backoffice interno | `uis/backoffice/` | Next.js 16 + React 19 + TypeScript, mismo patrón que `talent-pipeline-tracker` (ver decisión abajo) | Este cambio ("Monorepo AI Setup") |
| Incident analyzer (núcleo) | `packages/incident-analyzer/` | **Python ≥ 3.11, solo librería estándar** (`csv`, `re`, `dataclasses`, `decimal`, `enum`). Tests con `unittest` (sin pytest). `pyproject.toml` con `dependencies = []` (build backend setuptools, solo si alguien lo instala). Detalle de módulos y reglas en su `README.md` — no duplicado aquí | Procesador de incidentes, Fase 1 (2026-09-22) |
| Incident analyzer (CLI) | `scripts/analyze.py` | Capa fina sobre el núcleo (argparse, `input()`, códigos de salida). Sin lógica de negocio. Se ejecuta sin instalar el paquete (añade `packages/incident-analyzer` a `sys.path` si no está instalado) | Procesador de incidentes, Fase 1 |

Ambas apps Next.js (`talent-pipeline-tracker`, `backoffice`) tienen su propio `package.json`/`node_modules` — no hay workspaces de monorepo configurados en la raíz (el `README.md` raíz lo confirma: existe metadata de `packages/shared/package.json` pero "aún no hay runner de workspace en raíz").

## Estado real en `main` (verificado, no asumido)

`origin/main` **ya tiene mergeados** Hito 2 (PR #1, `feature/domain-models`) e Hito 3 (PRs #2 y #3, `feature/talent-pipeline-tracker`) — confirmado con `git log main..origin/main` y `git merge-base --is-ancestor`. Un agente que trabaje sobre `main` ve el árbol completo: `src/`, `uis/website/`, `uis/talent-pipeline-tracker/`.

## Decisiones de arquitectura registradas

### `uis/backoffice` usa Next.js 16 + React 19 + TypeScript

**Decisión:** mismo stack que `talent-pipeline-tracker`, no HTML estático como `website`.

**Motivo:** `uis/README.md` describe `backoffice` como el lugar para desarrollar **múltiples soluciones internas** dentro de un mismo proyecto (autenticación, gestión de personas, gestión de operaciones, comunicación interna) — eso implica routing y estado a futuro, no una landing estática. Introducir un tercer stack de frontend (además de HTML estático y Next.js) fragmentaría el mantenimiento sin necesidad. `website` no se toca ni se migra: sigue estático porque no lo necesita.

**Consecuencia:** cualquier feature nueva de `backoffice` sigue las mismas restricciones que `talent-pipeline-tracker` documenta en su propio `CLAUDE.md` (sin `any`, sin librerías de estado externas, sin dependencias nuevas no autorizadas) salvo que su propio `CLAUDE.md` diga lo contrario.

### `/services` no se crea

**Decisión:** no existe backend propio de Nexova en este repositorio todavía.

**Motivo:** ninguna app actual lo necesita. `talent-pipeline-tracker/SPECS.md` (§2.3, §5.1) verifica empíricamente que la API mock externa (`playground.4geeks.com/tracker/api/v1`) permite consumo directo desde el navegador (CORS abierto para todos los métodos usados) — el propio `SPECS.md` prohíbe explícitamente crear `app/api/` o un proxy para esa app. `website` es estático y no persiste datos. `backoffice` nace como placeholder de datos ya conocidos (`contexts/CONTEXT.md`), sin necesidad de API propia.

**Regla derivada:** `/services` se crea únicamente cuando un hito futuro defina un backend propio con contrato explícito — nunca por anticipación ni porque la plantilla lo mencione.

**Nota (2026-09-20):** existe una propuesta de arquitectura para ese backend en `docs/ARCHITECTURE_PROPOSAL.md` (un servicio FastAPI en `services/api/`, monolito modular por dominios). Es una **propuesta pendiente de aprobación del CTO**, no una decisión registrada: esta sección se actualizará con las decisiones concretas solo cuando se aprueben y se cree el servicio. Hasta entonces, la decisión anterior se mantiene tal cual. Ver `progress.md`, entrada 2026-09-20.

### Procesador de incidentes: lógica de análisis única en `packages/incident-analyzer/`

**Decisión (2026-09-22, aprobada por el tech lead como D8):** toda la lógica de análisis del CSV de incidentes (lectura, las 7 reglas de validación, métricas, reporte de consola, exportación `metric,value`) vive en el paquete Python `incident_analyzer`. `scripts/analyze.py` solo traduce argumentos a llamadas y resultados a salida.

**Motivo:** el mismo análisis tendrá más de un consumidor (hoy la CLI; está planteado un endpoint HTTP y una vista en el backoffice, **no implementados ni decididos**). Con un solo punto de entrada (`analyze_file`/`analyze_stream` → `AnalysisResult`) todos obtienen exactamente los mismos números. `packages/` es la carpeta del monorepo para código compartido versionable; un paquete dentro de `scripts/` habría obligado a un futuro backend a depender de `scripts/`.

**Consecuencias técnicas:**
- Primer código Python del monorepo (aparte de las plantillas de `agents/_template` y `skills/`). Python local verificado: 3.14.6.
- Solo librería estándar: no se autorizó ninguna dependencia. Cualquier dependencia (pytest, FastAPI...) requiere autorización explícita.
- Privacidad por diseño: `IncidentRow` redefine `repr`/`str`, `ValidationResult` solo guarda número de fila + reglas, `AnalysisResult` solo conteos, ningún módulo del núcleo imprime ni registra (lo comprueba `tests/test_privacy.py`).
- `.gitignore` raíz ignora `__pycache__/`, `*.py[cod]`, `data/raw/incidents/` (dataset real con emails) y `results.csv`.
- Validación del subproyecto: `python -m unittest discover -s packages/incident-analyzer/tests -t packages/incident-analyzer` (desde la raíz), registrado en la tabla de `AGENTS.md` §4.
- Esto **no** cambia la decisión "`/services` no se crea": la Fase 1 no crea backend.

## Skills y agentes en este repo

- `skills/data-analysis/` — limpieza pandas + referencia de métricas (ya existente, sin cambios).
- `.agents/skills/memory-bank-sync/` — nueva, ver `AGENTS.md` y la propia `SKILL.md`.

## Cómo verificar este documento

Cada stack listado arriba se contrasta contra el `package.json` real de esa carpeta (o su ausencia, en el caso de `website`, que no tiene build step). Si un `package.json` cambia de versión, este archivo debe actualizarse en el mismo cambio (ver skill `memory-bank-sync`).
