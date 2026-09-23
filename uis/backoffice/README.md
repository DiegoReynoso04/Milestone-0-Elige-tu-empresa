# Backoffice

Panel administrativo interno de **Nexova Solutions**. Tiene dos vistas: la portada con la ficha de la empresa y el **análisis de incidentes de soporte** (`/incidents`). No implementa autenticación ni ninguna otra capacidad de back-office.

## Vistas

### `/` — portada

- Una ficha de empresa (`lib/company.ts` → `NEXOVA_COMPANY`) con datos reales de Nexova: nombre, año de fundación, sede, oficina de expansión, empleados, facturación aproximada, CEO y líneas de negocio. Cada campo está respaldado literalmente por `contexts/CONTEXT.md` (ver los comentarios en `lib/company.ts` para la frase exacta) y resumido en [`memory-bank/projectbrief.md`](../../memory-bank/projectbrief.md) — `contexts/` es una carpeta local que no viaja con el repositorio (`.gitignore`), así que ese segundo archivo es la referencia disponible para quien clone el repo sin ella.
- Una lista de áreas internas de Nexova (RRHH, Ventas, Dirección Ejecutiva) descritas en ese mismo briefing que todavía no tienen herramienta propia en este monorepo — marcada explícitamente como roadmap, no como funcionalidad implementada.

### `/incidents` — análisis de incidentes de soporte

Fase 3 del procesador de incidentes de Nexova (Atención al Cliente — Roberto Díaz). Permite elegir el CSV de tickets de soporte, analizarlo, ver las métricas (totales, 7 reglas de invalidación, categorías, estados, satisfacción) y descargar `results.csv` (`metric,value`).

- **API consumida** ([`services/api`](../../services/api/README.md), contrato en [`SPECS.md`](../../services/api/SPECS.md)): `POST /api/incidents/analyze` y `GET /api/incidents/results/export`, directamente desde el navegador (CORS de la API). Todo el análisis lo hace el backend; el frontend no replica reglas de negocio.
- **Requisitos funcionales:** [`docs/COMPANY_INCIDENT_FILE_ANALIZER_PROJECT.md`](../../docs/COMPANY_INCIDENT_FILE_ANALIZER_PROJECT.md) (describe un script; la interfaz web es decisión del tech lead).
- **Límite de tamaño:** el límite real lo impone la API: **1048576 bytes (1 MiB) sobre el body HTTP completo** (CSV + cabeceras multipart), configurable en el servidor con `MAX_UPLOAD_BYTES`. La comprobación del navegador (extensión `.csv` y tamaño ≤ 1 MiB − 4 KiB) es solo **orientativa** para avisar antes de subir; el backend es la autoridad y su 413 siempre se trata. El texto de la interfaz dice "aproximadamente 1 MiB".
- **Exportación:** va ligada al análisis mostrado (se comprueba `X-Analysis-Id`). Si llega un análisis nuevo mientras se exporta el anterior, esa descarga se cancela; si el análisis nuevo falla, la del anterior termina.
- **Privacidad:** el frontend **no lee ni muestra el contenido del CSV** (el archivo se envía tal cual; no hay `FileReader`, `file.text()` ni vista previa) y nunca muestra `customer_email` ni datos de filas: solo nombre y tamaño del archivo, las métricas agregadas y mensajes de error fijos. No hay logs ni persistencia en el navegador, y nada se envía a servicios externos.
- **Sin autenticación:** igual que la API, es de **uso local**.

## Stack técnico

Mismo stack que [`uis/talent-pipeline-tracker`](../talent-pipeline-tracker/README.md), decisión registrada en [`memory-bank/techContext.md`](../../memory-bank/techContext.md): Next.js 16 (App Router), React 19, TypeScript estricto, Tailwind CSS v4 (`@import "tailwindcss"` en `app/globals.css`, sin `tailwind.config.ts`). Sin librerías de estado externas y sin dependencias añadidas para `/incidents`.

## Puesta en marcha

Requisitos: Node.js 20 o superior para la app; **Node.js 24** para ejecutar los tests (`node --test` con TypeScript sin dependencias). Para `/incidents`, además, la API de `services/api` en marcha (ver su README).

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000 (.env.local está ignorado por git)
npm run dev                  # servidor de desarrollo en http://localhost:3000
npm run build                # build de producción
npm run start                # sirve el build
```

| Variable | Valor local | Uso |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | URL base de `services/api`. Se incorpora al JavaScript **en tiempo de build** (`NEXT_PUBLIC_*`). Si falta, `/incidents` muestra un error de configuración al usarla; el build no falla |

`.env.example` es solo documentación: Next.js no lo carga (solo lee `.env`, `.env.local`, `.env.$(NODE_ENV)` y `.env.$(NODE_ENV).local`).

La API solo acepta por defecto el origen `http://localhost:3000` (CORS, ver `services/api/README.md`). Si el backoffice arranca en otro puerto porque el 3000 está ocupado, hay que liberar ese puerto o añadir el origen en `CORS_ALLOWED_ORIGINS` de la API.

## Validación

Desde `uis/backoffice`:

```bash
npx tsc --noEmit
npm run lint
npm run build
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/support/resolve-alias.mjs --test --test-timeout=10000 "tests/*.test.mjs"
```

Los tests (`tests/*.test.mjs`) usan el runner nativo de Node 24, sin dependencias: normalizadores, cliente HTTP, servicio de incidentes, estado/sesión del hook (cancelación, carreras, exportación) y una revisión estática del código de producción (sin `any`, `unknown` solo en `services/normalizers.ts`, `fetch` solo en `lib/api-client.ts`, sin lectura del archivo ni persistencia). `tests/support/resolve-alias.mjs` resuelve el alias `@/` para Node sin tocar `tsconfig.json`. El aviso `MODULE_TYPELESS_PACKAGE_JSON` se silencia porque `package.json` no declara `"type"`.

La unión con React (montaje/desmontaje) y la descarga real se validan manualmente en el navegador.

## Estructura

```text
app/
├── layout.tsx                  # layout raíz: cabecera con enlace a / y navegación a /incidents
├── page.tsx                    # portada: ficha de empresa + roadmap
├── incidents/page.tsx          # /incidents: Server Component (metadata) que renderiza la vista cliente
└── globals.css                 # Tailwind v4 + paleta y tokens semánticos compartidos con talent-pipeline-tracker

components/
├── ui/                         # primitivas: button, loading-spinner, alert, nav-link
└── incidents/                  # vista cliente (incident-analysis-view) + componentes presentacionales

hooks/use-incident-analysis.ts  # estado de /incidents: reducer + sesión (cancelación, carreras, exportación)
services/
├── incidents.service.ts        # frontera HTTP de incidentes (prevalidación UX, mapeo de errores, export)
└── normalizers.ts              # única frontera con `unknown` de red
lib/
├── api-client.ts               # cliente HTTP genérico (timeout, errores tipados, sin credentials)
└── company.ts                  # datos de Nexova, cada campo citado desde contexts/CONTEXT.md
types/incidents.ts              # contrato que recibe el frontend
tests/                          # tests node --test (.mjs) + support/

.env.example                    # variables de entorno documentadas (sin secretos)
```

## Documentación relacionada

- [`CLAUDE.md`](./CLAUDE.md) — restricciones vigentes para este subproyecto, incluidas las de `/incidents`.
- [`memory-bank/techContext.md`](../../memory-bank/techContext.md) — por qué este proyecto usa Next.js en vez del HTML estático de `uis/website`, y decisiones técnicas de `/incidents`.
- [`memory-bank/projectbrief.md`](../../memory-bank/projectbrief.md) — resumen versionado del briefing de Nexova (el original, `contexts/CONTEXT.md`, es local y no viaja con el repositorio).
