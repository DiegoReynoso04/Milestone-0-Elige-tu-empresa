# Backoffice — restricciones permanentes

Fuente de verdad de negocio: `contexts/CONTEXT.md` si existe en tu checkout (carpeta local, no viaja con el repositorio — ver `.gitignore` raíz), o [`memory-bank/projectbrief.md`](../../memory-bank/projectbrief.md) si no. Fuente de verdad de decisión técnica: [`memory-bank/techContext.md`](../../memory-bank/techContext.md).

## Alcance actual

Esto es **solo el punto de entrada** del backoffice, no una feature terminada. No añadir capacidades de negocio (autenticación, gestión de personas, operaciones, comunicación interna) sin un contexto de hito propio que las respalde — mismo criterio que `uis/talent-pipeline-tracker` (que sí tiene su `SPECS.md`).

## Datos mostrados

- `lib/company.ts` es la única fuente de datos de la vista de entrada. Cada campo de `NEXOVA_COMPANY` y de `PENDING_INTERNAL_AREAS` está citado desde `contexts/CONTEXT.md` (local) / `memory-bank/projectbrief.md` (versionado).
- No editar `lib/company.ts` con datos que no tengan respaldo literal en esas fuentes. Si falta un dato, preguntar — no inventarlo.

## Stack

- Next.js (App Router), TypeScript estricto, Tailwind CSS v4 (config vía CSS, sin `tailwind.config.ts`) — mismo stack que `uis/talent-pipeline-tracker`, decisión registrada en `memory-bank/techContext.md`.
- Solo hooks nativos de React si se añade estado. Prohibido Redux, Zustand, Recoil, Jotai u otra librería de estado externa.
- No añadir ninguna dependencia nueva sin autorización explícita.
- Prohibido `any`.

## Arquitectura

- Cuando esta app empiece a consumir una API propia, seguir el mismo patrón de frontera de confianza que `uis/talent-pipeline-tracker` (`services/normalizers.ts` como único lugar con `unknown` de red) — no antes de que exista esa API.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
