# Project Brief — Nexova Solutions

> Fuente de verdad ampliada: `contexts/CONTEXT.md`. **Esa carpeta está en `.gitignore` (raíz, línea 8) y no viaja con el repositorio** — solo existe en checkouts locales que ya la tenían. Este archivo es el resumen derivado de ese briefing, y es **el único contexto de negocio que sí está versionado y disponible para cualquiera que clone el repo**. Si tienes acceso local a `contexts/CONTEXT.md`, úsalo para profundizar; si no, este resumen debe bastar.

## La empresa

**Nexova Solutions** es una consultora de recursos humanos y adquisición de talento fundada en **2011**, con sede en **Valencia, España**, y una oficina de expansión en **Miami, Florida**. Tiene **120 empleados** y factura aproximadamente **8 millones de dólares anuales**. CEO: **Laura Mendoza**.

Tres líneas de negocio:

1. **Headhunting** ejecutivo y de mandos medios.
2. **Outsourcing** de equipos de soporte al cliente para empresas tecnológicas.
3. **Formación corporativa** en soft skills y liderazgo.

Clientes: medianas empresas de tecnología, retail y servicios financieros que externalizan gestión de talento.

## Por qué existe este repositorio

Nexova tiene reputación y red de contactos, pero **no tiene infraestructura para operar a escala**: procesos manuales, cero telemetría, decisiones con datos de una semana de antigüedad. Un equipo de AI Engineering (este repo) construye los sistemas, automatizaciones y herramientas inteligentes para que Nexova haga lo que ya hace bien, pero más rápido y con menos esfuerzo manual.

## Departamentos activos en este repo (hasta ahora)

| Departamento | Responsable | Qué se construyó | Dónde |
|---|---|---|---|
| Marketing y Comunicación | Carmen Ruiz | Sitio web corporativo (landing + formulario de registro de talento) — Hito 1 | `uis/website/` |
| Operaciones de Selección | Javier Almeida | Lógica de dominio: scoring y matching de candidatos — Hito 2 | `src/` (raíz) |
| Formación Corporativa (L&D) + Tecnología e Infraestructura | Elena Vargas (solicitante) / Sergio Molina (CTO) | Talent Pipeline Tracker — panel interno de gestión de candidaturas — Hito 3 | `uis/talent-pipeline-tracker/` |
| Atención al Cliente (outsourcing de soporte) | Roberto Díaz (Customer Support Lead) / Sergio Molina (CTO) | Procesador de reportes de incidentes: análisis del CSV exportado del helpdesk legado (validación, métricas por categoría/estado, índice de satisfacción, exportación) sin enviar datos a herramientas de IA externas — Fase 1 (núcleo + CLI), Fase 2 (API HTTP local, sin autenticación) y Fase 3 (vista web `/incidents` en el backoffice) | `packages/incident-analyzer/` + `scripts/analyze.py` + `services/api/` + `uis/backoffice/` (`/incidents`) |

Ver `contexts/hito1/CONTEXT-WEB-NEXOVA.md`, `contexts/hito2/CONTEXT-HITO2.md` y `contexts/hito3/CONTEXT-HITO3.md` para el briefing completo de cada encargo. El del procesador de incidentes es [`docs/COMPANY_INCIDENT_FILE_ANALIZER_PROJECT.md`](../docs/COMPANY_INCIDENT_FILE_ANALIZER_PROJECT.md) — a diferencia de los anteriores, vive en `docs/`, no en `contexts/`.

## Departamentos descritos en `contexts/CONTEXT.md` sin herramienta propia todavía

- **Ventas y Desarrollo de Negocio** — Marcos Ibáñez / Megan Clarke.
- **Recursos Humanos (interno)** — Patricia Solís.
- **Dirección Ejecutiva** — Laura Mendoza (informe semanal manual).

Cualquier funcionalidad nueva para estas áreas debe partir de un contexto de hito real (igual que Hitos 1–3), nunca de una suposición.

## Regla de trazabilidad

Ningún dato de negocio (nombre, cifra, responsable, proceso) se añade a este repositorio — código, UI o documentación — sin poder señalarse en `contexts/CONTEXT.md` o en un `contexts/hitoN/*.md`. Ver `.agents/rules/nexova-context.md`.
