@AGENTS.md

# Talent Pipeline Tracker — Restricciones permanentes

Fuente de verdad: `SPECS.md` (raíz del proyecto). Ante cualquier duda no cubierta aquí ni en SPECS.md, pregunta — no asumas.

## Stack
- Next.js (App Router), TypeScript estricto, Tailwind CSS v4 (config vía CSS, sin `tailwind.config.ts`).
- Estado: solo hooks nativos de React (`useState`, `useReducer`, `useContext`, `useOptimistic`, hooks propios). Prohibido Redux, Zustand, Recoil, Jotai u otra librería de estado.
- No añadir ninguna dependencia nueva sin autorización explícita.

## Tipos
- Prohibido `any` en todo el proyecto.
- `unknown` solo se permite en `services/normalizers.ts` (frontera de confianza red → tipos firmes).
- Prohibido usar `as` para forzar el tipo de una respuesta de red.

## Contrato con la API
- Prohibido inventar campos, endpoints o formas de respuesta que no estén en `SPECS.md` (OpenAPI o contrato observado §4.8). Si falta algo, pregunta antes de asumir.
- La API usa tres formatos de envoltorio distintos entre endpoints (§4.8.4): un normalizador por endpoint en `services/normalizers.ts`, nunca uno genérico.
- Nunca establecer `credentials` en `fetch` (§5.1): el CORS de la API combina `Allow-Origin: *` con `Allow-Credentials: true` (inválido); el navegador rechaza la petición si se envían credenciales.

## Arquitectura
- Los componentes nunca hacen llamadas HTTP directas: toda petición pasa por `services/`.
- Client Components para listado y detalle; fetch desde el navegador, sin Route Handlers ni proxy.

## Tono e identidad
- Esto es una herramienta interna de Nexova Solutions (Operaciones de Selección), no una app genérica: sobria, funcional, orientada a eficiencia operativa, coherente con el contexto y la imagen de la empresa.
