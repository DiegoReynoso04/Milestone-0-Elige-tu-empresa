# Backoffice — restricciones permanentes

Fuente de verdad de negocio: `contexts/CONTEXT.md` si existe en tu checkout (carpeta local, no viaja con el repositorio — ver `.gitignore` raíz), o [`memory-bank/projectbrief.md`](../../memory-bank/projectbrief.md) si no. Fuente de verdad de decisión técnica: [`memory-bank/techContext.md`](../../memory-bank/techContext.md).

## Alcance actual

El backoffice tiene dos piezas, y **solo estas dos**:

1. **Vista de entrada (`/`)** — ficha de empresa y roadmap. Se mantiene tal cual.
2. **Análisis de incidentes de soporte (`/incidents`)** — capacidad de negocio **autorizada** por el tech lead como Fase 3 del procesador de incidentes de Nexova (rama `feature/incident-analyzer`). Ver sección propia abajo.

Cualquier otra capacidad de negocio (autenticación, gestión de personas, operaciones, comunicación interna…) sigue **prohibida** sin un contexto de hito propio que la respalde — mismo criterio que `uis/talent-pipeline-tracker` (que tiene su `SPECS.md`).

## Datos mostrados

- `lib/company.ts` es la única fuente de datos de la vista de entrada. Cada campo de `NEXOVA_COMPANY` y de `PENDING_INTERNAL_AREAS` está citado desde `contexts/CONTEXT.md` (local) / `memory-bank/projectbrief.md` (versionado).
- No editar `lib/company.ts` con datos que no tengan respaldo literal en esas fuentes. Si falta un dato, preguntar — no inventarlo. La funcionalidad de incidentes **no** se añade a `lib/company.ts` ni cambia la portada.
- Los datos de `/incidents` vienen **exclusivamente** de la API de análisis (`services/api`); el frontend no genera cifras propias.

## Análisis de incidentes (`/incidents`)

Fuentes de verdad, por orden:

- Requisitos funcionales (CSV, reglas, métricas, privacidad): [`docs/COMPANY_INCIDENT_FILE_ANALIZER_PROJECT.md`](../../docs/COMPANY_INCIDENT_FILE_ANALIZER_PROJECT.md). Ese documento describe un script: **no define ninguna interfaz web**; la UI es una decisión del tech lead.
- Contrato HTTP: [`services/api/SPECS.md`](../../services/api/SPECS.md) (`POST /api/incidents/analyze`, `GET /api/incidents/results/export`). Prohibido inventar campos, endpoints o formas de respuesta que no estén ahí; si falta algo, preguntar.

Reglas específicas:

- **Consume la API propia** del procesador de incidentes directamente desde el navegador (CORS configurado en la API). Sin Server Actions, Route Handlers ni proxy: el CSV no debe pasar por el servidor de Next.
- **URL de la API** solo desde `NEXT_PUBLIC_API_URL` (ver `.env.example`; valor local `http://localhost:8000`). Nunca literal en el código. Validación **perezosa**: si falta, la UI muestra un error de configuración en el momento de usarla; **`npm run build` no debe fallar** por ausencia de `.env.local`. `NEXT_PUBLIC_*` se fija en tiempo de build (guía de Next 16 `environment-variables`).
- **Sin reglas de negocio en el frontend.** La validación del contenido del CSV (las 7 reglas, categorías, estados, scores) es del backend (`packages/incident-analyzer`). La única prevalidación permitida en cliente es de UX: extensión `.csv` y un tamaño máximo con **4 KiB de margen** bajo 1 MiB. Ese margen **no es el límite real**: el límite es técnico, de la API, se aplica al **body HTTP completo** (1 MiB por defecto, configurable en el servidor) y el 413 del servidor es siempre la fuente de verdad (`services/api/SPECS.md` §3.1).
- **Idioma:** interfaz en español; las etiquetas de métricas (`label` de reglas y puntuaciones, `code` de categorías y estados) se muestran **tal como las devuelve la API, en inglés**. No duplicar ni traducir el vocabulario del dominio en el frontend.
- **Frontera de confianza:** `services/normalizers.ts` es el único lugar con `unknown` de red. Los componentes nunca hacen HTTP: toda petición pasa por `services/` y `lib/api-client.ts`.
- **Privacidad (obligatoria):** `customer_email` y cualquier dato de las filas del CSV no pueden aparecer en la UI, el estado, logs ni mensajes de error. El contenido del archivo **no se lee en JavaScript** (sin `FileReader`, `file.text()` ni vista previa): el `File` va directo a `FormData`. Prohibido `console.*` con datos de respuestas o errores, y persistir resultados en `localStorage`/`sessionStorage`/IndexedDB. Los mensajes de error mostrados se eligen por `code` de la API, no copiando texto crudo de respuestas.
- **Arquitectura de `/incidents`:** `app/incidents/page.tsx` es un Server Component (exporta la metadata) que renderiza `components/incidents/incident-analysis-view.tsx` (`'use client'`). La vista solo interactúa a través de `hooks/use-incident-analysis.ts`, que es la frontera de interacción: únicamente él llama a `services/incidents.service.ts`, gestiona cancelación/carreras y hace la descarga (el Blob nunca llega a los componentes ni al estado). Los demás componentes son presentacionales.
- **Navegación:** enlace "Análisis de incidentes" en la cabecera del layout (`components/ui/nav-link.tsx`, con `aria-current`); la portada no se modifica.
- **Tests:** módulos puros (normalizadores, cliente, servicio, estado/sesión del hook) y revisión estática del código de producción con el runner nativo de Node 24, **sin añadir dependencias**. Comando exacto en el `README.md` (sección Validación). Los componentes se validan con `tsc` + `lint` + `build` y verificación manual en el navegador.
- **Primitivas de UI** (botón, spinner, alerta): se reescriben localmente siguiendo el patrón de `uis/talent-pipeline-tracker/components/ui/`; no hay paquete compartido.

## Stack

- Next.js (App Router), TypeScript estricto, Tailwind CSS v4 (config vía CSS, sin `tailwind.config.ts`) — mismo stack que `uis/talent-pipeline-tracker`, decisión registrada en `memory-bank/techContext.md`.
- Solo hooks nativos de React si se añade estado. Prohibido Redux, Zustand, Recoil, Jotai u otra librería de estado externa.
- No añadir ninguna dependencia nueva sin autorización explícita.
- Prohibido `any`.

## Arquitectura

- Al consumir una API propia (hoy: la de análisis de incidentes), seguir el mismo patrón de frontera de confianza que `uis/talent-pipeline-tracker`: `services/normalizers.ts` como único lugar con `unknown` de red, errores tipados en `lib/api-client.ts`, y componentes sin HTTP directo.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
