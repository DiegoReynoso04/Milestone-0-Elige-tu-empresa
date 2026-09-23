# AGENTS.md — Nexova Monorepo

Flujo operativo obligatorio para cualquier agente de IA que trabaje en este repositorio. Reglas granulares en [`.agents/rules/`](./.agents/rules/); skills reutilizables en [`.agents/skills/`](./.agents/skills/).

## 1. Antes de tocar nada

Leer, en este orden:

1. [`memory-bank/projectbrief.md`](./memory-bank/projectbrief.md) — quién es Nexova, qué se ha construido, quién lo pidió.
2. [`memory-bank/techContext.md`](./memory-bank/techContext.md) — stacks reales, decisiones de arquitectura vigentes.
3. [`memory-bank/progress.md`](./memory-bank/progress.md) — qué está hecho, qué está en curso, problemas conocidos.

Para el briefing de negocio completo (no el resumen), leer `contexts/CONTEXT.md` **si existe en tu checkout** — esa carpeta está en `.gitignore` y no viaja con el repositorio (ver nota en `techContext.md`). Si no la tienes, `memory-bank/projectbrief.md` es la referencia de negocio disponible. **No** el `CONTEXT.md` de la raíz que menciona `README.md` — ese archivo ya no existe.

## 2. Antes de trabajar en una carpeta concreta

Leer el `README.md` de esa carpeta de primer nivel (`uis/README.md`, `services/README.md`, etc. — ver `.agents/rules/monorepo-structure.md`) y, si el subproyecto tiene su propia documentación (`CLAUDE.md`, `AGENTS.md`, `SPECS.md` — por ejemplo `uis/talent-pipeline-tracker/`), leerla también.

**Las reglas locales de una app priman sobre las de este archivo dentro de su propio árbol** (ver `.agents/rules/app-specific-overrides.md`), nunca al revés.

## 3. Reglas duras (detalle en `.agents/rules/`)

- No inventar datos de negocio sobre Nexova ni campos/endpoints/estructuras de API que no estén documentados o verificados.
- No crear una app, servicio o carpeta fuera del lugar que le corresponde según la convención del `README.md` raíz.
- No añadir dependencias nuevas a ningún subproyecto sin autorización explícita.
- No duplicar en `.agents/` ni en `memory-bank/` lo que ya documenta un `SPECS.md`/`CLAUDE.md` propio de una app — referenciar, no copiar.

## 4. Flujo antes de commit (obligatorio, en este orden)

Ningún agente commitea código sin completar estos cinco pasos, en orden:

1. **Ejecutar la validación del subproyecto tocado.** Este monorepo **no** tiene un comando único de verificación — cada subproyecto valida el suyo:

   | Subproyecto | Comando |
   |---|---|
   | `src/` (Hito 2 — domain models) | `npm run check` (typecheck + tests) |
   | `uis/talent-pipeline-tracker/` | `npx tsc --noEmit` + `npm run lint` |
   | `uis/backoffice/` | `npx tsc --noEmit` + `npm run lint` + `npm run build` |
   | `uis/website/` | sin build step — verificación manual/visual |
   | `packages/incident-analyzer/` + `scripts/analyze.py` | `python -m unittest discover -s packages/incident-analyzer/tests -t packages/incident-analyzer` (desde la raíz) |
   | `services/api/` | **Requiere el venv del servicio** (con el Python global falla al importar `fastapi`). Desde la raíz, sin activar nada: `services\api\.venv\Scripts\python -m unittest discover -s services/api/tests -t services/api` (Windows) o `services/api/.venv/bin/python -m unittest discover -s services/api/tests -t services/api` (Linux/macOS). Crear/instalar el venv: ver `services/api/README.md` |

   Si el cambio afecta a más de un subproyecto, ejecutar todos los comandos que correspondan.

2. **Revisar el diff real antes de comitear:** `git status --short` y `git diff --stat`. Confirmar que no se incluyen archivos generados (`node_modules/`, `.next/`, `*.log`, `*.tsbuildinfo`) ni dependencias no autorizadas en ningún `package.json` tocado.

3. **Confirmar fidelidad al contexto de negocio:** ningún dato nuevo sobre Nexova (nombre, cifra, responsable, proceso) queda sin respaldo en `contexts/CONTEXT.md` (si existe localmente) o `memory-bank/projectbrief.md` — ver `.agents/rules/nexova-context.md`.

4. **Sincronizar el banco de memoria:** aplicar la skill [`memory-bank-sync`](./.agents/skills/memory-bank-sync/SKILL.md) — actualizar `progress.md` (y `techContext.md`/`projectbrief.md` si corresponde). Sin esto, el banco de memoria queda desactualizado en días y la siguiente sesión de agente vuelve a empezar de cero.

5. **Comitear.** El mensaje de commit y la descripción del PR explican el *por qué*, no solo el *qué* — el *qué* ya lo dice el diff.
