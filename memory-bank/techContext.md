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
| Incident analyzer (UI) | `uis/backoffice/` → ruta `/incidents` | Mismo stack del backoffice, **sin dependencias nuevas**. Tests con el runner nativo de **Node 24** (`node --test` sobre `.mjs` que importan los `.ts`, TypeScript por borrado de tipos). Reglas en `uis/backoffice/CLAUDE.md` — no duplicadas aquí | Procesador de incidentes, Fase 3 (2026-09-23) |
| Incident analyzer (núcleo) | `packages/incident-analyzer/` | **Python ≥ 3.11, solo librería estándar** (`csv`, `re`, `dataclasses`, `decimal`, `enum`). Tests con `unittest` (sin pytest). `pyproject.toml` con `dependencies = []` (build backend setuptools, solo si alguien lo instala). Detalle de módulos y reglas en su `README.md` — no duplicado aquí | Procesador de incidentes, Fase 1 (2026-09-22) |
| Incident analyzer (CLI) | `scripts/analyze.py` | Capa fina sobre el núcleo (argparse, `input()`, códigos de salida). Sin lógica de negocio. Se ejecuta sin instalar el paquete (añade `packages/incident-analyzer` a `sys.path` si no está instalado) | Procesador de incidentes, Fase 1 |
| Incident analyzer (API) | `services/api/` | **FastAPI 0.141.1 + Starlette 1.7.0 + pydantic 2.13.5 + python-multipart 0.0.32 + uvicorn 0.53.0**; tests con `unittest` + `TestClient` (httpx 0.28.1), sin pytest. Versiones instaladas el 2026-09-23 en `services/api/.venv` con Python 3.14.6; `pyproject.toml` las acota con rangos (ver decisión abajo), sin lockfile. Contrato en su `SPECS.md` — no duplicado aquí | Procesador de incidentes, Fase 2 (2026-09-23) |

Ambas apps Next.js (`talent-pipeline-tracker`, `backoffice`) tienen su propio `package.json`/`node_modules` — no hay workspaces de monorepo configurados en la raíz (el `README.md` raíz lo confirma: existe metadata de `packages/shared/package.json` pero "aún no hay runner de workspace en raíz").

## Estado real en `main` (verificado, no asumido)

`origin/main` **ya tiene mergeados** Hito 2 (PR #1, `feature/domain-models`) e Hito 3 (PRs #2 y #3, `feature/talent-pipeline-tracker`) — confirmado con `git log main..origin/main` y `git merge-base --is-ancestor`. Un agente que trabaje sobre `main` ve el árbol completo: `src/`, `uis/website/`, `uis/talent-pipeline-tracker/`.

## Decisiones de arquitectura registradas

### `uis/backoffice` usa Next.js 16 + React 19 + TypeScript

**Decisión:** mismo stack que `talent-pipeline-tracker`, no HTML estático como `website`.

**Motivo:** `uis/README.md` describe `backoffice` como el lugar para desarrollar **múltiples soluciones internas** dentro de un mismo proyecto (autenticación, gestión de personas, gestión de operaciones, comunicación interna) — eso implica routing y estado a futuro, no una landing estática. Introducir un tercer stack de frontend (además de HTML estático y Next.js) fragmentaría el mantenimiento sin necesidad. `website` no se toca ni se migra: sigue estático porque no lo necesita.

**Consecuencia:** cualquier feature nueva de `backoffice` sigue las mismas restricciones que `talent-pipeline-tracker` documenta en su propio `CLAUDE.md` (sin `any`, sin librerías de estado externas, sin dependencias nuevas no autorizadas) salvo que su propio `CLAUDE.md` diga lo contrario.

### `/services` no se crea — **SUPERADA el 2026-09-23**

> **Superada:** el tech lead autorizó crear `services/api/` para la Fase 2 del procesador de incidentes, con contrato explícito en `services/api/SPECS.md` (que es justo la condición que fijaba la "regla derivada" de abajo). Ver la decisión "Procesador de incidentes: API HTTP en `services/api/`". Se conserva el texto original como historial. **`docs/ARCHITECTURE_PROPOSAL.md` sigue pendiente de aprobación del CTO**: crear este servicio no la aprueba ni adopta implícitamente (p. ej. no se usa `/api/v1`).

**Decisión (original):** no existe backend propio de Nexova en este repositorio todavía.

**Motivo:** ninguna app actual lo necesita. `talent-pipeline-tracker/SPECS.md` (§2.3, §5.1) verifica empíricamente que la API mock externa (`playground.4geeks.com/tracker/api/v1`) permite consumo directo desde el navegador (CORS abierto para todos los métodos usados) — el propio `SPECS.md` prohíbe explícitamente crear `app/api/` o un proxy para esa app. `website` es estático y no persiste datos. `backoffice` nace como placeholder de datos ya conocidos (`contexts/CONTEXT.md`), sin necesidad de API propia.

**Regla derivada:** `/services` se crea únicamente cuando un hito futuro defina un backend propio con contrato explícito — nunca por anticipación ni porque la plantilla lo mencione.

**Nota (2026-09-20):** existe una propuesta de arquitectura para ese backend en `docs/ARCHITECTURE_PROPOSAL.md` (un servicio FastAPI en `services/api/`, monolito modular por dominios). Es una **propuesta pendiente de aprobación del CTO**, no una decisión registrada: esta sección se actualizará con las decisiones concretas solo cuando se aprueben y se cree el servicio. Hasta entonces, la decisión anterior se mantiene tal cual. Ver `progress.md`, entrada 2026-09-20.

### Procesador de incidentes: lógica de análisis única en `packages/incident-analyzer/`

**Decisión (2026-09-22, aprobada por el tech lead como D8):** toda la lógica de análisis del CSV de incidentes (lectura, las 7 reglas de validación, métricas, reporte de consola, exportación `metric,value`) vive en el paquete Python `incident_analyzer`. `scripts/analyze.py` solo traduce argumentos a llamadas y resultados a salida.

**Motivo:** el mismo análisis tiene más de un consumidor (la CLI y, desde la Fase 2, la API de `services/api`, que a su vez consume la vista `/incidents` del backoffice de la Fase 3). Con un solo punto de entrada (`analyze_file`/`analyze_binary_stream`/`analyze_stream` → `AnalysisResult`) todos obtienen exactamente los mismos números. `packages/` es la carpeta del monorepo para código compartido versionable; un paquete dentro de `scripts/` habría obligado a un futuro backend a depender de `scripts/`.

**Consecuencias técnicas:**
- Primer código Python del monorepo (aparte de las plantillas de `agents/_template` y `skills/`). Python local verificado: 3.14.6.
- Solo librería estándar: no se autorizó ninguna dependencia. Cualquier dependencia (pytest, FastAPI...) requiere autorización explícita.
- Privacidad por diseño: `IncidentRow` redefine `repr`/`str`, `ValidationResult` solo guarda número de fila + reglas, `AnalysisResult` solo conteos, ningún módulo del núcleo imprime ni registra (lo comprueba `tests/test_privacy.py`).
- `.gitignore` raíz ignora `__pycache__/`, `*.py[cod]`, `data/raw/incidents/` (dataset real con emails) y `results.csv`.
- Validación del subproyecto: `python -m unittest discover -s packages/incident-analyzer/tests -t packages/incident-analyzer` (desde la raíz), registrado en la tabla de `AGENTS.md` §4.
- 2026-09-23 (D-API-9): se añadió `analyze_binary_stream(stream: BinaryIO)` (UTF-8 con BOM opcional, `newline=""`, no cierra el stream, error de decodificación → `IncidentFileError` sin encadenar). `analyze_file` la reutiliza. El núcleo sigue sin depender de ningún framework web.

### Procesador de incidentes: API HTTP en `services/api/`

**Decisión (2026-09-23, tech lead, D-API-1…11):** un servicio FastAPI en `services/api/` que es una capa fina sobre `incident_analyzer` (router → service → núcleo). Detalle completo y procedencia de cada decisión en `services/api/SPECS.md`.

**Puntos técnicos a recordar:**
- **Rutas** `POST /api/incidents/analyze` y `GET /api/incidents/results/export`, más `GET /health`. **No** vienen de `docs/COMPANY_INCIDENT_FILE_ANALIZER_PROJECT.md` (que no define ninguna API): son decisión de implementación. Sin `/api/v1`.
- **Estado en memoria** (`LastResultStore` en `app.state`, `threading.Lock`): guarda **el último análisis que termina correctamente** (con peticiones concurrentes gana la que termina después, no la que empezó después; no se ordena por hora de inicio). Solo `analysis_id`, `analyzed_at` y `AnalysisResult`. Se pierde al reiniciar, es global al proceso y exige **un único worker**. Un POST fallido (400/413/415/422/500) no lo modifica.
- **Límite** `MAX_UPLOAD_BYTES` = 1 MiB por defecto (decisión técnica, no del cliente), aplicado al **body HTTP completo** (CSV + cabeceras y delimitadores multipart), **no al CSV**: body de exactamente 1 MiB → aceptado, 1 MiB + 1 → 413; un CSV de exactamente 1 MiB se rechaza. `Content-Length` → 413 inmediato; sin él, se cuentan bytes en streaming. El error lanzado al leer el body hereda de `fastapi.HTTPException` porque FastAPI convierte cualquier otra excepción de parseo en 400. Con ≤ 1 MiB Starlette nunca vuelca el upload (con PII) a disco (`SpooledTemporaryFile` de 1 MiB) — lo verifica un test que espía `SpooledTemporaryFile.rollover`.
- **Caché**: `Cache-Control: no-store` en las respuestas 200 de análisis y exportación.
- **Errores** `{detail, code}`, conservando las cabeceras de la excepción (el 405 incluye `Allow`); el 422 elimina `input`/`ctx`/`url`; el 500 lo produce un middleware propio (no `exception_handler(Exception)`, que Starlette relanza y el servidor registraría con el mensaje) y solo registra el nombre de la clase.
- **CORS** `CORS_ALLOWED_ORIGINS` (por defecto `http://localhost:3000`), solo `GET`/`POST`, sin credenciales, `*` rechazado al arrancar; expone `X-Analysis-Id` y `Content-Disposition`.
- **Configuración** con un `dataclass` de la librería estándar (sin pydantic-settings ni python-dotenv): la API no carga `.env`.
- **Sin autenticación**: solo uso local.
- **Dependencias**: `pyproject.toml` propio con rangos acotados a las versiones probadas y sin lockfile: `fastapi>=0.141,<0.142`, `python-multipart>=0.0.32,<0.1`, `uvicorn>=0.53,<0.54`; extra `dev` = `httpx>=0.28,<0.29`. Sin pytest, pydantic-settings ni python-dotenv.
- **Núcleo local, no declarado como dependencia**: `nexova-incident-analyzer` no está en `dependencies` a propósito — el nombre está libre en PyPI y declararlo expondría a *dependency confusion*. Se instala siempre en la misma orden que el servicio: `pip install -e packages/incident-analyzer -e "services/api[dev]"` (venv en `services/api/.venv`). `.venv/` y `*.egg-info/` en `.gitignore`.
- **Validación**: requiere el venv del servicio (con el Python global falla al importar `fastapi`). Desde la raíz sin activar nada: `services\api\.venv\Scripts\python -m unittest discover -s services/api/tests -t services/api` (Windows) o `services/api/.venv/bin/python -m unittest ...` (Linux/macOS); registrado en `AGENTS.md` §4 junto al de la Fase 1, que sigue funcionando con cualquier Python ≥ 3.11.
- **Aviso conocido**: Starlette 1.7 emite `StarletteDeprecationWarning` recomendando `httpx2` para `TestClient`; se mantiene `httpx` (dependencia autorizada).

### Procesador de incidentes: UI `/incidents` en `uis/backoffice`

**Decisión (2026-09-23, tech lead, H1–H12 de la Fase 3):** la vista web del procesador vive en el backoffice como ruta `/incidents`, consume `services/api` directamente desde el navegador y no reimplementa ninguna regla del análisis. Las reglas vivas están en `uis/backoffice/CLAUDE.md`; aquí solo las decisiones técnicas permanentes:

- **Capas** (de fuera a dentro): `app/incidents/page.tsx` (Server Component: exporta `metadata`, que Next 16 solo permite en servidor) → `components/incidents/incident-analysis-view.tsx` (`'use client'`) → `hooks/use-incident-analysis.ts` (**frontera de interacción**: reducer puro + "sesión" sin React que gestiona `AbortController`, carreras y descarga) → `services/incidents.service.ts` (prevalidación de UX, mapeo `status`+`code` → `UiError`, export ligado a `X-Analysis-Id`) → `lib/api-client.ts` (cliente genérico, único `fetch`, timeout, errores tipados sin `cause`) → `services/normalizers.ts` (única frontera con `unknown`; whitelist de campos). El JSON viaja tipado como `JsonValue` hasta el normalizador. Los componentes son presentacionales y no ven el Blob.
- **Carreras:** solo la última ejecución vigente puede cambiar el estado o descargar. Un análisis nuevo aborta el anterior; si tiene éxito, aborta la exportación del resultado anterior (no descarga); si falla, el resultado anterior sigue visible y su exportación puede terminar. Al desmontar se aborta todo y no se despacha nada.
- **`NEXT_PUBLIC_API_URL`** (`http://localhost:8000` en local, documentada en `uis/backoffice/.env.example`, versionada gracias a `!.env.example` en su `.gitignore`): se lee de forma **perezosa** en cada petición; sin ella la UI muestra un error de configuración y **el build no falla**. Se incorpora al bundle en tiempo de build.
- **Límite de archivo:** la prevalidación del navegador (`.csv` y ≤ 1 MiB − 4 KiB) es solo orientativa; el backend (1048576 bytes sobre el body HTTP) es la autoridad y su 413 siempre se trata.
- **Idioma:** interfaz en español; etiquetas y códigos del dominio tal como los devuelve la API (inglés), sin traducir.
- **Privacidad:** el contenido del CSV nunca se lee en JavaScript (el `File` va directo a `FormData`); en estado solo hay la referencia al `File`, el `AnalysisResult` y `UiError`; mensajes de error fijos por `code` (solo `invalid_csv.detail` se muestra); sin `console.*`, sin persistencia en el navegador, sin `JSON.stringify` de datos.
- **Tests sin dependencias:** runner nativo de **Node 24** (`node --test`) sobre archivos `.mjs` que importan los `.ts` (borrado de tipos nativo). `tests/support/resolve-alias.mjs` resuelve el alias `@/` con `module.registerHooks`, sin tocar `tsconfig.json`. `production-source.test.mjs` revisa estáticamente todo el código de producción. No hay renderizador de React ni DOM en los tests: la unión con React y la descarga real se validan manualmente en el navegador.
- **Validación**: `npx tsc --noEmit` + `npm run lint` + `npm run build` + el comando de tests, registrado en `AGENTS.md` §4.

## Skills y agentes en este repo

- `skills/data-analysis/` — limpieza pandas + referencia de métricas (ya existente, sin cambios).
- `.agents/skills/memory-bank-sync/` — nueva, ver `AGENTS.md` y la propia `SKILL.md`.

## Cómo verificar este documento

Cada stack listado arriba se contrasta contra el `package.json` real de esa carpeta (o su ausencia, en el caso de `website`, que no tiene build step). Si un `package.json` cambia de versión, este archivo debe actualizarse en el mismo cambio (ver skill `memory-bank-sync`).
