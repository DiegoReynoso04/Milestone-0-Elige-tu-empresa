# Backoffice

Punto de entrada del panel administrativo interno de **Nexova Solutions**. Scaffold inicial — todavía no implementa autenticación, gestión de personas ni ninguna otra capacidad de back-office; existe para tener algo real y visible desde el primer día sobre el que crecer.

## Qué muestra hoy

- Una ficha de empresa (`lib/company.ts` → `NEXOVA_COMPANY`) con datos reales de Nexova: nombre, año de fundación, sede, oficina de expansión, empleados, facturación aproximada, CEO y líneas de negocio. Cada campo está respaldado literalmente por `contexts/CONTEXT.md` (ver los comentarios en `lib/company.ts` para la frase exacta) y resumido en [`memory-bank/projectbrief.md`](../../memory-bank/projectbrief.md) — `contexts/` es una carpeta local que no viaja con el repositorio (`.gitignore`), así que ese segundo archivo es la referencia disponible para quien clone el repo sin ella.
- Una lista de áreas internas de Nexova (RRHH, Ventas, Dirección Ejecutiva) descritas en ese mismo briefing que todavía no tienen herramienta propia en este monorepo — marcada explícitamente como roadmap, no como funcionalidad implementada.

## Qué NO hace todavía (a propósito)

- No tiene autenticación.
- No consume ninguna API (los datos que muestra son estáticos, tomados directamente del contexto de la empresa).
- No implementa ninguna de las áreas del roadmap — cada una requerirá su propio contexto de hito antes de construirse (mismo criterio que `uis/talent-pipeline-tracker`).

## Stack técnico

Mismo stack que [`uis/talent-pipeline-tracker`](../talent-pipeline-tracker/README.md), decisión registrada en [`memory-bank/techContext.md`](../../memory-bank/techContext.md): Next.js 16 (App Router), React 19, TypeScript estricto, Tailwind CSS v4 (`@import "tailwindcss"` en `app/globals.css`, sin `tailwind.config.ts`). Sin librerías de estado externas.

## Puesta en marcha

Requisitos: Node.js 20 o superior.

```bash
npm install
npm run dev      # servidor de desarrollo en http://localhost:3000
npm run build    # build de producción
npm run lint     # ESLint
```

## Estructura

```text
app/
├── layout.tsx    # layout raíz con cabecera propia
├── page.tsx      # vista de entrada: ficha de empresa + roadmap
└── globals.css   # Tailwind v4 + paleta compartida con talent-pipeline-tracker

lib/
└── company.ts    # datos de Nexova, cada campo citado desde contexts/CONTEXT.md
```

## Documentación relacionada

- [`CLAUDE.md`](./CLAUDE.md) — restricciones vigentes para este subproyecto.
- [`memory-bank/techContext.md`](../../memory-bank/techContext.md) — por qué este proyecto usa Next.js en vez del HTML estático de `uis/website`.
- [`memory-bank/projectbrief.md`](../../memory-bank/projectbrief.md) — resumen versionado del briefing de Nexova (el original, `contexts/CONTEXT.md`, es local y no viaja con el repositorio).
