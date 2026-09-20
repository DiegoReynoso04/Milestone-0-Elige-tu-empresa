# Nexova Backend — Architecture Proposal

> **Estado:** propuesta inicial, pendiente de revisión por el CTO (Sergio Molina).
> **Tipo de entregable:** exclusivamente documental. Este documento **no** implementa ningún backend: no existe `services/api/`, no hay dependencias nuevas, no hay endpoints. Todo lo que aquí se describe es una propuesta de diseño para el primer backend propio de Nexova.
> **Fecha:** 2026-09-18.
> **Convención de lectura:** cada afirmación relevante va marcada como **[HECHO]** (verificable hoy en el repositorio o en `contexts/`), **[PROPUESTA]** (recomendación de este documento) o **[PENDIENTE]** (decisión que no debe cerrarse todavía por falta de contexto).

---

## 1. Contexto y objetivo

Nexova Solutions es una consultora de recursos humanos y adquisición de talento fundada en 2011, con sede en Valencia (España) y oficina de expansión en Miami (Florida), 120 empleados y ~8 M USD de facturación anual, en tres líneas de negocio: headhunting, outsourcing de soporte al cliente y formación corporativa **[HECHO — `memory-bank/projectbrief.md`, `contexts/CONTEXT.md`]**.

El equipo de AI Engineering (este repositorio) ha completado cuatro entregables y una capa de gobierno para agentes, todos **sin backend propio** **[HECHO — `memory-bank/progress.md`]**. El siguiente paso, encargado por el CTO, es **diseñar la arquitectura del backend antes de escribir una línea de código**. Este documento responde a esa petición: patrón arquitectónico, estructura de carpetas, dominios, organización de routers FastAPI, separación frontend/backend, decisiones técnicas iniciales, riesgos y decisiones que quedan abiertas.

**Qué NO es este documento:** no es una especificación de endpoints ni un contrato OpenAPI. Los endpoints que aparecen son ejemplos arquitectónicos para ilustrar la organización, no un compromiso de API. Cuando llegue la implementación, cada módulo tendrá su propio `SPECS.md` con el contrato verificado, siguiendo el precedente de `uis/talent-pipeline-tracker/SPECS.md`.

**Lugar del documento:** `docs/` es, según `README.md` raíz y `.agents/rules/monorepo-structure.md`, la carpeta de "arquitectura y decisiones transversales". El backend, cuando exista, vivirá en `services/` (misma regla). Este documento no crea esa carpeta.

---

## 2. Contexto actual del sistema

### 2.1 Inventario real (verificado en el repositorio)

| Componente | Ruta | Stack | Persistencia | Estado |
|---|---|---|---|---|
| Sitio web público + formulario de talento (Hito 1) | `uis/website/` | HTML estático + Tailwind v4 (Play CDN), Vanilla JS | Ninguna — el envío del formulario se **simula** en `validations.js` | Hecho, desplegado en Netlify |
| Modelos de dominio y scoring de candidatos (Hito 2) | `src/` (raíz) | TypeScript estricto, funciones puras, `node:test` | Ninguna — librería en memoria | Hecho, 97 tests verdes |
| Talent Pipeline Tracker (Hito 3) | `uis/talent-pipeline-tracker/` | Next.js 16 (App Router, Client Components) + React 19 + TS | API mock **externa** `https://playground.4geeks.com/tracker/api/v1` (compartida entre alumnos, sin auth) | Hecho funcionalmente |
| Backoffice (punto de entrada) | `uis/backoffice/` | Next.js 16 + React 19 + TS | Ninguna — datos estáticos en `lib/company.ts` | Scaffold |
| Gobierno para agentes IA | `AGENTS.md`, `.agents/`, `memory-bank/` | Markdown | — | Activo |

**[HECHO]** No existe en el repositorio: backend propio, base de datos, autenticación, CI/CD, Docker, `services/` con contenido (solo el README de plantilla).

### 2.2 Lo que el tracker ya nos enseñó sobre integrar un frontend con un backend

El Hito 3 es la referencia más valiosa para diseñar el backend, porque ya resolvió —a nivel de cliente— los problemas que un backend propio debe resolver desde el servidor **[HECHO — `SPECS.md` §0, §3.1, §4.8, §5.1, §5.4]**:

- **Contrato explícito, nada inventado:** cinco incógnitas del contrato (V-1..V-5) se verificaron empíricamente antes de escribir código, y se documentaron como "contrato observado". La API mock resultó tener **tres formatos de envoltorio distintos** (`{total,page,limit,data}`, `{data, meta:{total}}`, objeto desnudo), lo que obligó a un normalizador por endpoint. → *Lección para el backend:* un formato de respuesta uniforme desde el día uno ahorra esa fricción a cada frontend.
- **Frontera de confianza:** `services/normalizers.ts` es el único lugar del tracker donde entra `unknown` de la red. → *Lección:* el backend debe emitir un contrato lo bastante estable como para que esa frontera sea barata de mantener.
- **CORS observado:** la API mock responde `Access-Control-Allow-Origin: *` junto con `Allow-Credentials: true`, combinación inválida que el `CLAUDE.md` del tracker prohíbe explotar. → *Lección:* el backend propio debe configurar CORS de forma explícita y correcta (§13).
- **URL por variable de entorno:** `NEXT_PUBLIC_API_URL`, leída en `lib/api-client.ts`, que falla en arranque si falta. → *Patrón a reutilizar* (§12).
- **Datos no fiables:** la API pública es escrita por terceros; `linkedin_url`/`cv_url` llegan con markdown crudo. → *Lección:* el backend propio valida en entrada y controla la calidad de sus datos.

### 2.3 Lo que el Hito 2 ya fija sobre el dominio

`src/types/models.ts` define `Candidate`, `Vacancy` y `SelectionProcess` con sus tipos union (`EnglishLevel`, `SeniorityLevel`, `AvailabilityStatus`, `CandidateStatus`, `VacancyStatus`, `ProcessStage`), y `src/utils/transformations.ts` implementa un scoring 0-100 en cinco dimensiones (habilidades 40, experiencia 20, seniority 15, inglés 15, salario 10) con 97 tests que fijan resultados exactos (p. ej. Carolina Silva → 100, María González → 92, Juan Pérez → 20 contra `sampleVacancy`) **[HECHO]**. Ese comportamiento es, hoy, la única especificación ejecutable de negocio que tiene Nexova, y el backend no puede contradecirlo (§16, §17).

---

## 3. Requisitos y características que condicionan la arquitectura

Todas las características siguientes se derivan de `contexts/CONTEXT.md` y de los tres contextos de hito; ninguna es inventada.

| # | Característica de Nexova | Fuente | Consecuencia arquitectónica |
|---|---|---|---|
| R1 | Empresa mediana (120 empleados) con un equipo técnico de **6 personas** liderado por el CTO | CONTEXT.md, "Tecnología e Infraestructura" | La arquitectura debe ser operable por un equipo pequeño: **un** despliegue, **un** repositorio de código backend, sin orquestación distribuida. |
| R2 | El negocio principal es Operaciones de Selección: **40 consultores** que criban CVs, hacen matching y siguen candidatos manualmente | CONTEXT.md; CONTEXT-HITO2 | El dominio de selección (candidatos, vacantes, pipeline, matching) es el núcleo y debe ser la primera prioridad del backend. |
| R3 | Cinco departamentos más con problemas descritos pero **sin hito propio**: Formación (12 personas), Soporte externalizado (30 agentes), Ventas (18 personas), RRHH interno, Dirección Ejecutiva | CONTEXT.md; `.agents/rules/nexova-context.md` | La arquitectura debe **reservar sitio** para esos dominios sin implementarlos; añadir un módulo nuevo no debe exigir reestructurar los existentes. |
| R4 | El stack actual de Nexova es un mosaico desconectado: HubSpot, Zendesk legacy, Google Workspace, un ATS a medida de los años 2010 y hojas de cálculo; **no hay telemetría ni logging centralizado** | CONTEXT.md | El backend será el primer sistema "central"; debe nacer con observabilidad mínima (logging estructurado, health check) y con una capa de integración externa aislada para futuras conexiones. |
| R5 | La dirección decide con datos de una semana de antigüedad; se piden dashboards en tiempo real y un informe semanal automático | CONTEXT.md, "Dirección Ejecutiva" | Los datos operativos (pipeline, vacantes) deben quedar en una base de datos consultable, no en la API mock ajena. Los dashboards son una fase posterior, pero el modelo de datos debe permitir agregaciones. |
| R6 | Ya existen **tres frontends independientes** con dos stacks distintos (HTML estático y Next.js) | `uis/` | El backend es un servicio HTTP/JSON consumido por varios orígenes distintos → CORS explícito y contrato estable. |
| R7 | Reglas de repositorio: no inventar datos, no añadir dependencias sin autorización, `/services` solo con contrato explícito, lógica de negocio verificable | `AGENTS.md`, `.agents/rules/*`, `memory-bank/techContext.md` | La propuesta debe ser conservadora en dependencias y dejar explícito qué queda pendiente. |
| R8 | Operación bilingüe España/Miami | CONTEXT.md | No condiciona el patrón, pero sí que las fechas se almacenen en UTC y que la localización sea responsabilidad del frontend (como ya hace `lib/format.ts` del tracker). |

**Lo que NO sabemos y no debemos asumir [PENDIENTE]:** volumen de datos (cuántos candidatos/vacantes al año), requisitos de disponibilidad, si habrá acceso de clientes externos ("portal de candidatos con estado en tiempo real" se menciona como deseo, no como requisito con criterios de aceptación), modelo de permisos, dónde se desplegará.

---

## 4. Alternativas consideradas

| Alternativa | Qué aporta | Por qué no encaja (o no todavía) con Nexova |
|---|---|---|
| **MVC clásico** (controlador → modelo → vista renderizada en servidor) | Simplicidad, un solo despliegue | La "vista" ya existe fuera del backend (tres frontends en `uis/`). Un backend MVC con templates duplicaría lo que Next.js ya hace. Lo que sí tomamos de MVC es la idea de controlador delgado (router). |
| **Arquitectura en capas "horizontal"** (carpetas `routers/`, `services/`, `repositories/`, `models/` transversales) | Reconocible, fácil de explicar | Con seis departamentos previstos (R3), las capas horizontales se convierten en carpetas de decenas de archivos sin frontera de dominio: `services/candidate_service.py` al lado de `services/training_service.py`. La cohesión se pierde en cuanto hay más de dos dominios. |
| **Microservicios** (un servicio por departamento) | Escalado y despliegue independientes | Un equipo de 6 personas (R1) sin telemetría ni CI/CD (R4) no puede operar N servicios, N bases de datos y una malla de comunicación. Además los dominios del núcleo (candidatos ↔ vacantes ↔ pipeline ↔ matching) son fuertemente cohesivos; partirlos crearía llamadas de red donde hoy hay llamadas a función. El propio `README.md` raíz de la plantilla recomienda "avoid splitting into many microservices early". |
| **Serverless / funciones** | Sin servidores que operar, coste por uso | Fragmenta el dominio en funciones sueltas, complica los tests de integración y el estado compartido (sesiones de BD, pool de conexiones). No hay evidencia de picos de carga que lo justifiquen. |
| **Clean / Hexagonal estricta** (puertos y adaptadores, entidades sin ninguna dependencia, casos de uso como clases) | Aislamiento total del framework y de la BD | El objetivo es correcto (§9 lo adopta parcialmente), pero la versión estricta añade una capa de indirección por cada operación (DTO de entrada, caso de uso, puerto, adaptador, presentador). Para un CRUD de candidatos eso es sobreingeniería que el equipo no necesita hoy. Adoptamos sus **principios** (dominio sin FastAPI, persistencia detrás de una interfaz) sin su **ceremonia**. |
| **Monolito modular por dominios, en capas dentro de cada módulo, un solo servicio FastAPI** | Un despliegue; fronteras de dominio explícitas; cada módulo internamente en capas; migrable a servicios si algún día hace falta | Es la opción que mejor equilibra R1–R7. Se desarrolla en §5. |

---

## 5. Patrón arquitectónico propuesto

**[PROPUESTA] Un único servicio FastAPI (`services/api/`) organizado como monolito modular: un paquete por dominio de negocio, y dentro de cada paquete una separación en capas (router → servicio de aplicación → dominio → repositorio).**

Tres ideas resumen el patrón:

1. **Vertical por dominio, horizontal dentro del dominio.** El código se agrupa primero por *de qué habla* (candidatos, vacantes, pipeline, matching) y solo después por *qué papel técnico cumple* (HTTP, aplicación, dominio, persistencia). Un desarrollador que trabaje en vacantes abre una carpeta, no cinco.

2. **Fronteras de dependencia estrictas.** Dentro de un módulo las capas solo dependen "hacia dentro" (el router conoce al servicio, el servicio conoce al dominio y al repositorio, el dominio no conoce a nadie). Entre módulos, un módulo solo puede usar la **capa de servicio pública** de otro, nunca sus repositorios ni sus modelos ORM.

3. **Composición centralizada pero delgada.** `main.py` solo crea la app, registra middlewares y monta un router agregador `/api/v1`; los módulos se incluyen mediante `APIRouter` + `include_router`, que es exactamente la convención que la documentación oficial de FastAPI describe para "Bigger Applications" (referencia [1]).

Este patrón se apoya en tres mecanismos concretos de FastAPI, elegidos tras revisar su documentación oficial:

| Mecanismo FastAPI | Cómo lo usamos | Por qué |
|---|---|---|
| `APIRouter(prefix=..., tags=..., dependencies=[...])` [1][2] | Un router por módulo de dominio, declarado dentro del paquete del módulo | Cada módulo es autocontenido; el prefijo y las dependencias comunes (p. ej. una futura autenticación) se declaran una vez por módulo. |
| `app.include_router(router, prefix="/api/v1")` y `router.include_router(other)` [1][2] | Un router agregador `api/v1/router.py` incluye todos los módulos; `main.py` incluye solo el agregador con el prefijo de versión | La documentación confirma que prefijo, tags y dependencias pueden fijarse **al incluir**, sin modificar el router original, y que los routers pueden anidarse. Eso es lo que permite versionar (§11) sin tocar los módulos. |
| Sistema de dependencias `Annotated[..., Depends(...)]`, con dependencias a nivel de path operation, de router y globales [3] | Inyección de sesión de base de datos, de `Settings` y —cuando exista— del usuario autenticado | Es el mecanismo idiomático de FastAPI para "compartir conexiones de base de datos" y "aplicar seguridad y roles" (cita literal de [3]); además `app.dependency_overrides` permite sustituirlas en tests [5]. |
| `pydantic-settings` `BaseSettings` + `get_settings()` cacheado [4] | Toda la configuración (URLs, orígenes CORS, credenciales) entra por variables de entorno | Recomendación oficial para "settings and environment variables"; permite override en tests. |
| `CORSMiddleware` con `allow_origins` explícitos [6] | Lista de orígenes por entorno leída de `Settings` | La documentación prohíbe combinar `["*"]` con `allow_credentials=True`; y ya sufrimos esa configuración inválida en la API mock (§2.2). |

---

## 6. Justificación de la propuesta

**Por qué un solo servicio.** Con seis técnicos (R1) y sin telemetría (R4), cada proceso adicional en producción es un coste operativo real (despliegue, logs, alertas, credenciales). Un monolito bien modularizado permite mantener fronteras de dominio claras y facilita el desarrollo y despliegue como una única unidad, evitando inicialmente la complejidad operativa de múltiples servicios. Si en el futuro un módulo (p. ej. el chatbot de soporte con RAG) necesitara escalar o desplegarse aparte, la modularidad reduce el acoplamiento y deja una frontera explícita que podría facilitar una futura extracción si existiera una razón operativa para convertir el módulo en un servicio independiente.

**Por qué modular por dominios y no por capas horizontales.** El contexto describe al menos seis áreas con datos, usuarios y definiciones de éxito distintas (R3). Organizar por capas horizontales mezcla todas las áreas en cada carpeta; organizar por dominio mantiene junto lo que cambia junto. También hace cumplible la regla `.agents/rules/nexova-context.md`: "no implementar funcionalidad para un departamento sin contexto de hito propio" se traduce en "no crear el paquete `modules/training/` hasta que exista `contexts/hitoN/`".

**Por qué capas dentro de cada módulo.** Porque el Hito 2 ya demostró el valor de la lógica de negocio pura: 97 tests que se ejecutan en menos de dos segundos, sin base de datos ni HTTP. Mantener el dominio libre de FastAPI y de ORM permite portar el scoring y testearlo con el mismo rigor (§16). Un router que hiciera el scoring inline sería intesteable sin levantar la app.

**Qué problema evita esta elección.** Evita el escenario más probable de degradación en un proyecto de este tamaño: un `main.py` de 2.000 líneas con todos los endpoints, consultas SQL dentro de los endpoints, y un frontend que depende de la forma exacta de las filas de la base de datos. Ese escenario es barato al principio y carísimo a los seis meses, cuando el segundo departamento entra en el sistema. La estructura de §8 hace que el camino fácil sea también el camino correcto.

**Qué cuesta.** Más archivos por módulo (cinco o seis en lugar de uno) y una disciplina de importaciones que hay que revisar en code review. Es un coste aceptable: es el mismo tipo de disciplina que el tracker ya impone con "los componentes no llaman a la API; todo pasa por `services/`".

---

## 7. Organización de dominios

### 7.1 Dominios del primer backend (MVP)

Todos derivan de contextos de hito ya existentes o de entidades ya modeladas en el repositorio.

| Dominio | Fundamento en el contexto | Entidades principales | Responsabilidad |
|---|---|---|---|
| **candidates** | Hito 2 (`Candidate` en `src/types/models.ts`); formulario de talento del Hito 1 captura exactamente datos de candidato (nombre, email, teléfono, país, experiencia, sector, inglés, disponibilidad, LinkedIn) | Candidato, habilidades, nivel de inglés, seniority, disponibilidad, expectativa salarial | Base de talento de Nexova: alta, consulta, búsqueda y validación de candidatos. Es el dominio que el Hito 1 hoy **simula** (el formulario no persiste) y que el Hito 2 modela en memoria. |
| **vacancies** | Hito 2 (`Vacancy`) | Vacante, empresa cliente, habilidades requeridas/preferidas, rango de experiencia y salario, modalidad | Posiciones abiertas que Nexova cubre para clientes. Sin vacantes no hay matching. |
| **pipeline** | Hito 2 (`SelectionProcess`) + Hito 3 (candidaturas con `status`/`stage` y notas internas) | Candidatura / proceso de selección, etapa, estado, notas internas | Seguimiento de un candidato dentro de un proceso concreto: es el dominio que hoy vive en la API mock externa del tracker. Las **notas** pertenecen aquí porque `CONTEXT-HITO3.md` las define como "notas internas después de cada llamada o entrevista", ligadas a una candidatura, no al candidato. |
| **matching** | Hito 2 (`transformations.ts`: scoring y ranking) | Puntuación por dimensión, ranking de candidatos para una vacante, agregados de reporte | Motor de scoring. No tiene tablas propias; lee candidatos y vacantes y devuelve resultados calculados. Sus reglas ya tienen 97 tests que actúan como especificación (§16). |

**Relaciones entre dominios (dirección de dependencia permitida):**

```
matching  ──lee──►  candidates
matching  ──lee──►  vacancies
pipeline  ──referencia por id──►  candidates
pipeline  ──referencia por id──►  vacancies
candidates ◄──X──► vacancies   (no se conocen entre sí)
```

`pipeline` y `matching` dependen de `candidates` y `vacancies`; nunca al revés. Esto evita ciclos y permite que `candidates` y `vacancies` sean los primeros módulos en implementarse y testearse de forma aislada.

### 7.2 Dominio transversal, no de negocio

| Módulo | Qué contiene | Nota |
|---|---|---|
| **health** | `GET /health` (liveness del proceso) | Endpoint técnico, no funcional: necesario desde el primer despliegue para saber si el servicio está vivo (R4: hoy "cuando algo falla, el equipo se entera a través de los usuarios"). No es un dominio de negocio; vive en `core/`, no en `modules/`, y se monta en la raíz del servicio, fuera de `/api/v1` (ver §11, "Ámbito del versionado"). |

### 7.3 Dominios reservados para futuros milestones [PENDIENTE]

Estos dominios están descritos en `contexts/CONTEXT.md` como problemas de negocio, **no** como especificaciones. Son **reservas conceptuales de la arquitectura**: nombres que ilustran dónde encajaría cada área si algún día se aprueba, **no módulos aprobados ni funcionalidades a implementar ahora**. Siguiendo `.agents/rules/nexova-context.md`, ninguno se crea hasta tener un contexto de hito con stakeholder, alcance y criterios de aceptación; los nombres pueden cambiar cuando ese contexto exista. La arquitectura solo garantiza que cabrán como un paquete más en `modules/`.

| Dominio futuro | Departamento / responsable (según CONTEXT.md) | Qué haría falta antes de crearlo |
|---|---|---|
| **users / auth** (usuarios internos, roles) | Transversal; hoy ninguna app tiene autenticación | Decisión del CTO sobre modelo de identidad (§12.5). Es el más probable como siguiente módulo, porque cualquier backoffice real lo necesita, pero **no hay requisito escrito**. |
| **company / departments** (ficha de empresa, estructura organizativa) | Hoy son datos estáticos en `uis/backoffice/lib/company.ts`, citados de CONTEXT.md | Solo tiene sentido como API si algún frontend necesita editarlos o si RRHH interno se convierte en hito. Mientras tanto, datos estáticos en el frontend es la solución correcta y más barata. |
| **training** (catálogo, inscripciones, recomendación) | Formación Corporativa — Elena Vargas | Contexto de hito. |
| **support** (tickets, base de conocimiento, RAG) | Atención al Cliente — Roberto Díaz | Contexto de hito. Candidato natural a extraerse como servicio propio si el RAG exige recursos distintos. |
| **sales** (pipeline comercial, secuencias, integración HubSpot) | Ventas — Marcos Ibáñez / Megan Clarke (CONTEXT.md nombra a ambos en secciones distintas; a resolver) | Contexto de hito + decisión de integración con HubSpot. |
| **hr** (vacaciones, onboarding, KPIs internos) | Recursos Humanos — Patricia Solís | Contexto de hito. |
| **executive / reporting** (dashboard unificado, informe semanal) | Dirección — Laura Mendoza | Depende de que los demás dominios persistan datos; es agregación, no fuente. |
| **telemetry** (logging centralizado, alertas) | Tecnología — Sergio Molina | Parcialmente cubierto por `core/logging` del MVP; un producto de telemetría completo es un hito propio. |

---

## 8. Estructura de carpetas

**[PROPUESTA]** Estructura del futuro `services/api/`. Se muestra completa para que sea reconocible como una aplicación FastAPI real; los módulos marcados `(futuro)` **no** se crean en el MVP.

```text
services/
└── api/                              # UN servicio FastAPI para toda la empresa
    ├── README.md                     # cómo arrancar, variables de entorno, comandos de validación
    ├── SPECS.md                      # contrato de la API (a redactar antes del código, como en el tracker)
    ├── pyproject.toml                # dependencias y metadatos (gestor a decidir, §19)
    ├── .env.example                  # plantilla de variables, SIN valores reales, versionada
    ├── .env                          # valores locales, gitignored (nunca versionado)
    │
    ├── app/
    │   ├── __init__.py
    │   ├── main.py                   # crea FastAPI(), middlewares, include_router(api_v1). Nada más.
    │   │
    │   ├── core/                     # transversal, sin conocimiento de ningún dominio
    │   │   ├── config.py             # Settings (pydantic-settings): env, CORS origins, DATABASE_URL…
    │   │   ├── logging.py            # configuración de logging estructurado
    │   │   ├── errors.py             # excepciones base del dominio + handlers HTTP (→ 404/409/422)
    │   │   └── health.py             # router de /health (liveness)
    │   │
    │   ├── dependencies.py           # dependencias comunes: get_settings, get_db_session (y, futuro, get_current_user)
    │   │
    │   ├── api/
    │   │   └── v1/
    │   │       └── router.py         # APIRouter agregador: incluye el router de cada módulo
    │   │
    │   ├── modules/                  # UN paquete por dominio de negocio
    │   │   ├── candidates/
    │   │   │   ├── router.py         # capa HTTP: APIRouter(prefix="/candidates", tags=["candidates"])
    │   │   │   ├── schemas.py        # modelos Pydantic de entrada/salida HTTP (CandidateCreate, CandidateOut…)
    │   │   │   ├── service.py        # capa de aplicación: casos de uso (registrar candidato, buscar…)
    │   │   │   ├── domain.py         # entidades y reglas puras (validaciones de negocio, tipos union)
    │   │   │   ├── models.py         # modelos ORM / tablas
    │   │   │   └── repository.py     # acceso a datos de este dominio
    │   │   ├── vacancies/            # misma estructura interna
    │   │   ├── pipeline/             # misma estructura; incluye las notas de candidatura
    │   │   ├── matching/             # SIN models.py ni repository.py: es cálculo puro sobre candidates/vacancies
    │   │   │   ├── router.py         # solo si se decide exponer matching por HTTP (pendiente, §10)
    │   │   │   ├── schemas.py        # ídem
    │   │   │   ├── service.py
    │   │   │   └── domain.py         # port del scoring de src/utils/transformations.ts
    │   │   ├── users/        (futuro, pendiente de decisión de auth)
    │   │   ├── training/     (futuro, pendiente de contexto de hito)
    │   │   └── ...
    │   │
    │   └── infrastructure/           # detalles técnicos compartidos, sustituibles
    │       ├── db/
    │       │   ├── session.py        # engine, SessionLocal, get_session()
    │       │   ├── base.py           # Base declarativa / metadata
    │       │   └── migrations/       # Alembic (o equivalente) — decisión pendiente §19
    │       └── external/             # clientes de sistemas externos (HubSpot, Zendesk…) — vacío en MVP
    │
    └── tests/
        ├── conftest.py               # fixtures: app de test, sesión de BD de test, dependency_overrides
        ├── unit/                     # dominio puro (matching, validaciones) — sin BD, sin HTTP
        ├── services/                 # capa de aplicación con repositorios falsos/en memoria
        ├── api/                      # TestClient contra los routers
        └── integration/              # repositorios contra una BD real de test
```

### 8.1 Responsabilidad de cada directorio

| Directorio | Qué vive aquí | Qué NO debe vivir aquí | De qué puede depender | Por qué está separado |
|---|---|---|---|---|
| `app/main.py` | Creación de la app, registro de `CORSMiddleware`, handlers de excepciones, `include_router(api_v1_router, prefix="/api/v1")` y `include_router(health_router)` (técnico, sin prefijo de versión, §11) | Endpoints propios, lógica, acceso a BD, configuración inline | `core/`, `api/v1/router.py` | Es el punto de composición. Si contiene lógica se convierte en el "main.py gigante" (riesgo §17.1). Debe caber en una pantalla. |
| `app/core/` | Configuración (`Settings`), logging, excepciones base, health | Nada que mencione candidatos, vacantes ni ningún dominio | Solo librerías externas | Es lo que todos los módulos comparten sin conocerse entre sí. Si `core/` importa de `modules/`, hay un ciclo. |
| `app/dependencies.py` | Funciones `Depends`-ables compartidas: sesión de BD, settings, (futuro) usuario actual | Lógica de negocio | `core/`, `infrastructure/db` | Sigue literalmente la convención de FastAPI "Bigger Applications" [1]. Las dependencias específicas de un módulo van en ese módulo. |
| `app/api/v1/router.py` | Un `APIRouter()` que hace `include_router(candidates.router)`, `include_router(vacancies.router)`, etc. | Endpoints propios | `modules/*/router.py` | Es el único archivo que conoce la lista de módulos. Añadir un módulo = una línea aquí. Permite un `api/v2/` futuro sin tocar `main.py` ni los módulos (§11). |
| `app/modules/<dominio>/router.py` | Path operations: parseo de request, llamada al servicio, mapeo a `schemas` de salida, códigos HTTP | Reglas de negocio, consultas SQL, cálculos | `service.py`, `schemas.py`, `dependencies` | Es la capa que FastAPI ve. Delgada por diseño: si un test necesita `TestClient` para probar una regla de negocio, la regla está en el sitio equivocado. |
| `app/modules/<dominio>/schemas.py` | Modelos Pydantic de **contrato HTTP**: `XCreate`, `XUpdate`, `XOut`, envoltorios de paginación | Modelos de tabla | Pydantic | Separar schema HTTP de modelo ORM es lo que el tutorial oficial de bases de datos recomienda para no dejar que el cliente fije el `id` ni exponer campos internos [7]. Es también lo que evita el riesgo §17.3. |
| `app/modules/<dominio>/service.py` | Casos de uso: orquesta dominio + repositorio, gestiona transacciones, lanza excepciones de dominio | Nada de `Request`/`Response`/`HTTPException` de FastAPI; nada de SQL | `domain.py`, `repository.py`, servicios de **otros** módulos (solo su interfaz pública) | Es la API interna del módulo: lo que otro módulo o un job futuro puede invocar sin pasar por HTTP. |
| `app/modules/<dominio>/domain.py` | Entidades, value objects, tipos union, reglas puras (p. ej. scoring, validaciones equivalentes a `validations.ts`) | Imports de FastAPI, de SQLAlchemy, de `Settings` | Solo la librería estándar (y Pydantic para tipos, si se decide) | Es el equivalente de `src/utils/*.ts`: testeable en milisegundos, sin infraestructura. Si el framework cambia, esto no cambia. |
| `app/modules/<dominio>/models.py` | Tablas ORM del dominio | Validaciones de negocio, lógica | `infrastructure/db/base` | Define la forma de persistencia, que puede divergir de la forma HTTP (columnas técnicas, índices, soft delete). |
| `app/modules/<dominio>/repository.py` | Consultas y escrituras del dominio contra la sesión | Reglas de negocio, mapeo HTTP | `models.py`, `infrastructure/db` | Concentra el SQL/ORM en un solo archivo por dominio; permite un repositorio en memoria para tests de servicio. |
| `app/infrastructure/` | Engine y sesión de BD, migraciones, clientes HTTP a sistemas externos | Lógica de negocio, endpoints | Librerías externas, `core/config` | Es lo sustituible: cambiar de base de datos o de proveedor de CRM toca aquí y en los repositorios, no en el dominio. |
| `tests/` | Ver §16 | Código de producción | Todo | Separada de `app/` para que el paquete desplegado no incluya tests ni fixtures. |

### 8.2 Reglas de importación (a vigilar en code review)

1. `core/` e `infrastructure/` **nunca** importan de `modules/`.
2. `domain.py` **nunca** importa de FastAPI, del ORM ni de `core/config`.
3. Un módulo solo importa de otro módulo su `service.py` (y, si hace falta, `schemas.py`/`domain.py` para tipos). Nunca `repository.py` ni `models.py` ajenos.
4. `router.py` no importa `repository.py` ni `models.py` de su propio módulo: pasa por `service.py`.
5. `main.py` solo importa `core/` y `api/v1/router.py`.

Estas reglas son la versión backend de las que el tracker ya aplica ("hooks no importan `api-client`", "componentes no hacen HTTP"). Cuando el proyecto lo justifique, pueden hacerse automáticas con un linter de importaciones (decisión pendiente, no se propone dependencia ahora).

### 8.3 Por qué esta estructura y no la del ejemplo del brief

El brief sugería `api/routers/`, `domains/`, `schemas/` e `infrastructure/` como carpetas hermanas. Se ha optado por meter router, schemas, servicio, dominio, modelos y repositorio **dentro de cada módulo** por dos razones: (a) con seis dominios previstos, una carpeta `schemas/` transversal tendría decenas de archivos de dominios distintos mezclados, y la regla "no crear un módulo por departamento sin contexto de hito" se vuelve difícil de auditar; (b) la documentación oficial de FastAPI agrupa por recurso (`routers/items.py`, `routers/users.py`), y esta propuesta lleva esa agrupación un paso más allá: no solo el router, sino todo lo del recurso. Lo que sí se conserva del brief: `core/`, `dependencies.py`, `api/` como capa de composición e `infrastructure/` compartida.

---

## 9. Responsabilidades de cada capa

Flujo de una petición, con los nombres de esta propuesta:

```
HTTP Request (JSON)
    │
    ▼
CORSMiddleware  ──►  rechaza orígenes no permitidos (§13)
    │
    ▼
api/v1/router.py  ──►  enruta por prefijo (/api/v1/candidates/…)
    │
    ▼
modules/candidates/router.py        CAPA HTTP
    · valida el cuerpo con schemas.CandidateCreate (Pydantic)
    · resuelve dependencias: sesión de BD, settings, (futuro) usuario
    · llama a service.register_candidate(...)
    · convierte el resultado a schemas.CandidateOut y el código HTTP (201)
    │
    ▼
modules/candidates/service.py       CAPA DE APLICACIÓN
    · caso de uso: "registrar candidato"
    · invoca reglas de domain.py (p. ej. validar email, rango de experiencia 0-50)
    · consulta/escribe a través de repository.py
    · abre/cierra la transacción
    · lanza excepciones de dominio (CandidateAlreadyExists, …), no HTTPException
    │
    ▼
modules/candidates/domain.py        CAPA DE DOMINIO
    · reglas puras, sin I/O: las mismas que hoy viven en src/utils/validations.ts
    · tipos y escalas ordinales (EnglishLevel A1…Native, Seniority Junior…Executive)
    │
    ▼
modules/candidates/repository.py    CAPA DE PERSISTENCIA
    · traduce operaciones de dominio a consultas ORM sobre models.py
    · no sabe nada de HTTP ni de reglas de negocio
    │
    ▼
infrastructure/db  ──►  Base de datos
    │
    ▼  (vuelta)
core/errors.py  ──►  traduce CandidateAlreadyExists → 409, NotFound → 404, ValidationError → 422
    │
    ▼
HTTP Response (JSON con schema de salida)
```

**Por qué cada frontera importa para Nexova, no en abstracto:**

- **Router sin lógica de negocio.** Cuando Ventas o Formación entren (R3), sus reglas serán distintas; si las reglas están en routers, cada endpoint nuevo reimplementa validaciones. Con la lógica en `service`/`domain`, un job nocturno (p. ej. el futuro informe semanal de Dirección, R5) puede reutilizar el mismo caso de uso sin pasar por HTTP.
- **Dominio sin FastAPI.** El Hito 2 demostró que las reglas de scoring cambian de resultado por detalles sutiles (tope de 40 en habilidades, salario por debajo del mínimo puntúa 10). Esas reglas deben poder testearse a la velocidad de `npm test` actual (97 tests en <2 s). Si dependieran de `Request` o de una sesión de BD, cada test costaría cien veces más y se escribirían menos.
- **Persistencia separada de los endpoints.** La base de datos es una decisión pendiente (§14). Si el SQL vive en repositorios, cambiar de motor o de ORM es un cambio localizado. Si vive en los endpoints, es una reescritura.
- **Excepciones de dominio traducidas en un solo sitio.** El tracker ya sufre que la API mock responda 404 con un cuerpo no documentado (`SPECS.md` §4.8.2). Un mapeo centralizado en `core/errors.py` garantiza que **todos** los módulos devuelvan el mismo formato de error, lo que abarata el `normalizers.ts` de cada frontend.

---

## 10. API y organización de routers

**[PROPUESTA]** Un `APIRouter` por módulo, montado bajo `/api/v1` por el agregador. El contrato real se fijará en `services/api/SPECS.md` antes de implementar.

> **Los siguientes endpoints no constituyen un contrato aprobado. Se muestran únicamente para demostrar cómo se distribuirían las responsabilidades entre routers y dominios.**

| Router (prefijo) | Responsabilidad | Recursos principales | Operaciones esperadas (ejemplos) | Relación con otros dominios | Fase |
|---|---|---|---|---|---|
| `/candidates` | Base de talento: alta, consulta y búsqueda de candidatos | Candidato; habilidades como atributo del candidato | `GET /candidates` (lista con filtros: skills, seniority, availability, búsqueda por nombre/email; paginación), `GET /candidates/{id}`, `POST /candidates`, `PUT /candidates/{id}` | Lo consumen `matching` y `pipeline` por id. Es el destino natural del formulario del Hito 1 cuando deje de simularse. | **MVP** |
| `/vacancies` | Vacantes que Nexova cubre para clientes | Vacante | `GET /vacancies` (filtros: status, isRemote), `GET /vacancies/{id}`, `POST /vacancies`, `PUT /vacancies/{id}`, `PATCH /vacancies/{id}` (solo `status`, mismo criterio que el tracker: cambio de estado ≠ edición de datos) | Lo consume `matching` y `pipeline` por id. | **MVP** |
| `/pipeline` | Candidaturas (proceso de selección) y sus notas internas | Candidatura (candidato × vacante), etapa, estado, nota | `GET /pipeline` (filtros: status, stage, vacancy_id, search), `GET /pipeline/{id}`, `POST /pipeline`, `PATCH /pipeline/{id}` (solo `status`/`stage`, como `RecordPatch` del tracker), `GET/POST /pipeline/{id}/notes`, `DELETE /pipeline/{id}/notes/{note_id}` | Referencia `candidates` y `vacancies`. Es el equivalente propio de lo que hoy ofrece la API mock al tracker (§17.10). | **MVP** |
| `/matching` | Scoring y ranking; solo lectura/cálculo | Puntuación, ranking | Si se expone: `GET /vacancies/{id}/ranking` (o `GET /matching/vacancies/{id}`) devolvería candidatos ordenados con desglose por dimensión; `GET /matching/score?candidate_id=&vacancy_id=` | Lee `candidates` y `vacancies` a través de sus servicios; no persiste. | **MVP como capacidad interna** (módulo `matching/domain.py` + `service.py`, es la lógica del Hito 2, la única con tests). **[PENDIENTE]** si se expone como endpoint HTTP en el MVP: ningún contexto de hito lo exige todavía; puede empezar como capacidad interna del backend, consumida por `pipeline` u otros módulos, y exponerse mediante endpoint cuando el producto lo requiera. |
| `/health` | Endpoint **técnico** de liveness del proceso (¿está vivo el servicio?), no parte de la API funcional | — | `GET /health` | Ninguna. Vive en `core/` y se incluye desde `main.py` en la raíz, no bajo `/api/v1`: el versionado (§11) aplica a la **API funcional** (recursos de negocio); un endpoint de infraestructura que consultan balanceadores y monitorización debe tener una ruta estable independiente de la versión del contrato. No es una excepción a la regla de versionado, sino algo fuera de su ámbito. | **MVP** |
| `/auth`, `/users` | Identidad y roles de usuarios internos | Usuario, rol | A definir | Dependencia de router para todos los demás cuando exista. | **Posterior** — sin requisito escrito (§12.5) |
| `/company`, `/departments` | Datos organizativos | Empresa, departamento, responsable | A definir | Hoy resuelto con datos estáticos en el backoffice. | **Posterior** — solo si un hito lo pide |
| `/training`, `/support`, `/sales`, `/hr`, `/reports` | Un router por departamento futuro | — | A definir en su contexto de hito | — | **Posterior** |

**Decisiones de diseño de la API que se proponen desde el MVP (y por qué):**

- **Envoltorio de paginación uniforme** para todas las listas, p. ej. `{ "data": [...], "total": n, "page": p, "limit": l }`. El tracker tuvo que escribir tres normalizadores porque la API mock usaba tres formatos (§2.2); un solo formato hace que el `normalizers.ts` de cada frontend sea un helper genérico.
- **Formato de error uniforme**, p. ej. `{ "detail": ..., "code": "candidate_not_found" }`, producido solo por `core/errors.py`. Los 422 de validación mantendrán el formato nativo de FastAPI (`detail[].loc/msg/type`) porque el tracker ya sabe mapearlo a campos de formulario (`candidate-form.tsx`, `fieldNameFromLoc`).
- **`PATCH` para cambios parciales de estado, `PUT` para reemplazos completos.** [PROPUESTA] Para los recursos del MVP, se propone reservar `PATCH` para cambios parciales de estado y utilizar `PUT` para reemplazos completos, siguiendo el contrato actualmente utilizado por el tracker (`SPECS.md` §4.4, §5.2, V-3). Es una convención de contrato propia de Nexova, no una regla universal de REST ni de FastAPI; se mantiene porque los consultores ya la conocen y porque evita reescribir `records.service.ts`.
- **Valores de `status`/`stage` como strings con lista de valores conocidos documentada**, no enums cerrados, para poder añadir etapas sin romper clientes desplegados — misma decisión que `SPECS.md` §4.1. **[PENDIENTE]** si el pipeline propio usa las etapas del Hito 2 (`Screening`…`Hired`) o las del Hito 3 (`pending`…`offer_presented`): son dos vocabularios distintos en el repositorio y hay que unificarlos con Operaciones de Selección antes de fijar el contrato.
- **Identificadores**: UUID generados por el servidor (nunca por el cliente, razón que da el tutorial oficial [7]). Los ejemplos del Hito 2 (`C-2024-0451`) pueden convivir como "código legible" opcional. **[PENDIENTE]** confirmar con Javier Almeida si el ATS actual usa códigos que haya que preservar.
- **Fechas en ISO 8601 UTC** (`...Z`), formateo en el frontend (R8; es lo que `lib/format.ts` ya hace).

---

## 11. Versionado de API

**[PROPUESTA]** Versionado por prefijo de ruta: `/api/v1/...`, implementado como `app.include_router(api_v1_router, prefix="/api/v1")` en `main.py`, siendo `api_v1_router` el agregador de `api/v1/router.py`.

**Por qué desde el principio, aunque el proyecto sea pequeño:**

1. **Ya hay tres clientes con ciclos de despliegue distintos** (R6): un sitio estático en Netlify, dos apps Next.js. No podemos actualizar todos a la vez. Cuando un cambio incompatible sea necesario, `/api/v2` permite convivir con `/api/v1` mientras cada frontend migra.
2. **La API mock que el tracker consume ya usa `/tracker/api/v1`** (`SPECS.md` §5.1). Mantener el mismo esquema hace que la migración del tracker al backend propio sea un cambio de `NEXT_PUBLIC_API_URL`, no de código de rutas.
3. **Cuesta cero**: es un prefijo en una línea de `main.py`, gracias a que `include_router` acepta `prefix` sin modificar los routers [1][2]. No hace falta nada más (ni cabeceras de versión, ni negociación de contenido).

**Ámbito del versionado:** el prefijo `/api/v1` cubre la **API funcional** (recursos de negocio: candidatos, vacantes, pipeline…). Los endpoints técnicos de infraestructura, hoy solo `/health` (§7.2, §10), viven en la raíz del servicio sin versión, porque su consumidor no es un frontend sino la monitorización, y su contrato ("responde 200 si el proceso está vivo") no cambia con el contrato de negocio. Esto no es una excepción al versionado: es que están fuera de su ámbito.

**Qué NO se propone:** versionar por cabecera, versionar módulo a módulo, ni crear `v2` "por si acaso". Se crea `api/v2/` únicamente cuando haya una ruptura de contrato real, y `v1` se mantiene hasta que ningún frontend desplegado la use.

**Regla asociada:** un cambio **aditivo** (campo nuevo opcional en una respuesta, endpoint nuevo) no cambia de versión. Un cambio que **rompe** (renombrar campo, cambiar tipo, quitar endpoint) sí. Los frontends, por su parte, deben tolerar campos desconocidos —el `normalizers.ts` del tracker ya lo hace: valida los campos que usa e ignora el resto.

---

## 12. Comunicación frontend/backend

### 12.1 Sistemas separados

**[HECHO]** Los tres frontends y el futuro backend son aplicaciones independientes, con su propio `package.json`/`pyproject.toml`, su propio despliegue y su propio ciclo de vida. No hay workspaces en la raíz (`memory-bank/techContext.md`). **[PROPUESTA]** Mantenerlo así: el backend no sirve HTML ni assets de los frontends, y los frontends no importan código Python.

**Comunicación:** exclusivamente HTTP/JSON sobre el contrato de `/api/v1`. Ni WebSockets ni eventos en el MVP (no hay requisito de tiempo real con criterios de aceptación; el "dashboard en tiempo real" de Dirección es una fase posterior).

### 12.2 URL del backend: variable de entorno, nunca hardcodeada

**[HECHO]** El tracker ya aplica el patrón correcto: `lib/api-client.ts` lee `process.env.NEXT_PUBLIC_API_URL`, lanza un error explícito en arranque si falta, y ningún componente conoce la URL (`CLAUDE.md`: "nunca URL literal fuera de la variable de entorno").

**[PROPUESTA]** Extender este patrón a todos los consumidores:

| Frontend | Cómo consume hoy | Cómo consumirá el backend propio |
|---|---|---|
| `uis/talent-pipeline-tracker/` | `NEXT_PUBLIC_API_URL=https://playground.4geeks.com/tracker/api/v1` en `.env.local` | Misma variable, apuntando a `https://<backend>/api/v1`. Requiere antes actualizar `SPECS.md` (regla: "este documento se actualiza antes que el código") y adaptar `normalizers.ts` al contrato propio. Ver riesgo §17.10. |
| `uis/backoffice/` | No consume API | Cuando lo haga: misma convención `NEXT_PUBLIC_API_URL` + réplica de la frontera de confianza (`services/normalizers.ts`), como su `CLAUDE.md` ya exige. |
| `uis/website/` | No consume API (formulario simulado) | Si el formulario de talento pasa a persistir en `POST /api/v1/candidates`: al ser HTML estático sin build, la URL no puede inyectarse por variable de entorno de Next. **[PENDIENTE]** decidir entre (a) un `config.js` generado en el deploy de Netlify, (b) un endpoint público específico con validación y rate limiting, o (c) migrar el formulario a una app con build. No se decide aquí; hoy el formulario no envía nada. |

**Distinción importante (documentación oficial de Next.js [8]):** las variables `NEXT_PUBLIC_*` se **inlinean en el bundle del navegador en tiempo de build**. Por tanto: (1) solo pueden contener información pública (una URL base lo es); (2) cambiar de entorno exige rebuild; (3) **jamás** un secreto con ese prefijo.

### 12.3 Contratos, no detalles internos

**[PROPUESTA]** El frontend depende únicamente del contrato HTTP publicado (OpenAPI generado por FastAPI + `SPECS.md`), nunca de:

- nombres de tablas o columnas (por eso `schemas.py` ≠ `models.py`, §8.1);
- la existencia de un ORM, un caché o una cola;
- la estructura interna de `modules/`.

En sentido inverso, el backend no sabe qué frontend le llama: no hay endpoints "para el tracker" o "para el backoffice", hay endpoints de dominio. Si dos frontends necesitan vistas distintas del mismo recurso, se resuelve con parámetros de consulta o con campos opcionales, no con endpoints por cliente.

**Mecanismo de verificación:** FastAPI genera `/openapi.json` automáticamente. Ese documento es el contrato; los frontends pueden generar tipos a partir de él o, como hace el tracker hoy, escribir los tipos a mano y validarlos en `normalizers.ts`. **[PENDIENTE]** si se generan tipos automáticamente (requeriría una dependencia nueva en cada frontend, que hoy está prohibida sin autorización).

### 12.4 Orígenes distintos por entorno

| Entorno | Frontends (origen) | Backend (origen) | ¿Cross-origin? |
|---|---|---|---|
| Desarrollo local | `http://localhost:3000` (Next.js dev, tracker **o** backoffice — ambos usan el puerto 3000 por defecto, no pueden correr a la vez sin cambiar uno) ; el website se abre como archivo o con un servidor estático local | `http://localhost:8000` (puerto por defecto de uvicorn) | Sí → CORS necesario |
| Staging | **[PENDIENTE]** no existe hoy | **[PENDIENTE]** | Sí, presumiblemente |
| Producción | Website: dominio de Netlify (existe hoy, URL no registrada en el repo); tracker/backoffice: **[PENDIENTE]** dónde se despliegan | **[PENDIENTE]** | Sí, salvo que se sirvan bajo el mismo dominio con un proxy inverso (decisión de infraestructura, no de código) |

### 12.5 Autenticación

**[HECHO]** Ninguna aplicación del repositorio tiene autenticación; la API mock del tracker "no declara `securitySchemes`" (`SPECS.md` §5.1); el backoffice "no tiene autenticación" a propósito (`uis/backoffice/README.md`).

**[PENDIENTE — no inventar]** No existe ningún contexto de hito que defina quién debe poder hacer qué. Por tanto este documento **no** elige mecanismo (JWT, sesión, OAuth con Google Workspace —que Nexova usa como "tejido conectivo" según CONTEXT.md—, etc.). Lo único que la arquitectura garantiza es que, cuando se decida, encaje sin refactor:

- se implementará como una **dependencia** (`get_current_user` en `dependencies.py`) aplicada a nivel de router (`APIRouter(dependencies=[Depends(...)])`) o en `include_router`, que es el mecanismo que la documentación de FastAPI señala para "enforce security, authentication, role requirements" [3][1];
- vivirá en un módulo `users`/`auth` propio (§7.3);
- **hasta entonces, el backend no debe desplegarse en un origen accesible públicamente con datos reales de candidatos.** Además de la ausencia de control de acceso, debe existir una revisión de privacidad y protección de datos antes de utilizar datos reales de candidatos en un entorno accesible públicamente; este documento no emite conclusiones jurídicas, solo señala que esa revisión es un requisito previo. Ver §17.11.

---

## 13. CORS y configuración por entorno

### 13.1 Por qué hará falta

Los navegadores aplican la *same-origin policy* a `fetch()`: una página cargada desde `http://localhost:3000` no puede leer la respuesta de `http://localhost:8000` salvo que el servidor lo autorice mediante cabeceras CORS [9]. Un origen es la combinación de esquema + dominio + puerto [6]; `localhost:3000` y `localhost:8000` son orígenes distintos. Además, las peticiones que el tracker ya hace (`PATCH`, `PUT`, `DELETE`, `Content-Type: application/json`) **disparan preflight `OPTIONS`** [9], que el backend debe responder.

**[HECHO]** Esto ya ocurre hoy con la API mock: `SPECS.md` §5.1 documenta el preflight observado (`Access-Control-Allow-Methods: DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT`, `Max-Age: 600`).

### 13.2 Configuración propuesta

**[PROPUESTA]** `CORSMiddleware` de FastAPI [6], registrado en `main.py`, con la lista de orígenes leída de `Settings` (variable `CORS_ALLOWED_ORIGINS`, lista separada por comas):

| Entorno | `CORS_ALLOWED_ORIGINS` | Notas |
|---|---|---|
| Desarrollo | `http://localhost:3000` (+ el puerto alternativo si se corre tracker y backoffice a la vez) | Se fija en `.env` local, no en código. |
| Staging | Orígenes exactos de los frontends de staging | **[PENDIENTE]** no existen. |
| Producción | Orígenes exactos de producción (p. ej. el dominio de Netlify del website si algún día llama a la API, y los de tracker/backoffice) | **[PENDIENTE]** dominios no definidos. Nunca `*`. |

Reglas derivadas de la documentación oficial:

- **Nunca `allow_origins=["*"]` como configuración permanente.** La documentación de FastAPI es explícita: "None of `allow_origins`, `allow_methods` and `allow_headers` can be set to `['*']` if `allow_credentials` is set to `True`" [6], y MDN confirma que el navegador rechaza esa combinación [9]. Es exactamente la configuración inválida que la API mock tiene hoy y que el tracker esquiva no enviando `credentials` (`CLAUDE.md`). El backend propio **no** debe reproducir ese error.
- `allow_credentials` se deja en `False` **hasta que exista autenticación** (§12.5). Si la autenticación futura usa cookies o cabecera `Authorization`, pasará a `True` **y** los orígenes seguirán siendo explícitos.
- `allow_methods` explícitos: los que la API use (`GET, POST, PUT, PATCH, DELETE, OPTIONS`). `allow_headers` explícitos: `Content-Type` (y `Authorization` cuando exista auth).
- `allow_origin_regex` [6] queda como herramienta para *preview deployments* con subdominios variables (p. ej. `https://.*--nexova\.netlify\.app`), solo si se adopta ese flujo de despliegue. No en el MVP.
- `max_age` por defecto (600 s) es suficiente.

### 13.3 Qué se configura por entorno y cómo

**[PROPUESTA]** Toda variación entre entornos entra por variables de entorno leídas en `core/config.py` (`Settings`, §15). El código es idéntico en desarrollo, staging y producción; lo que cambia es el `.env` (local) o las variables del proveedor de despliegue. No existe `if ENV == "production":` disperso por el código; existe **un** objeto `Settings` con campos como `environment`, `cors_allowed_origins`, `database_url`, `log_level`.

---

## 14. Persistencia y base de datos

### 14.1 Lo que sabemos [HECHO]

- No existe ninguna base de datos propia; ninguna app persiste datos; el único almacenamiento es la API mock ajena del tracker, no fiable ni controlable.
- El dominio ya está modelado con **relaciones claras y estructuradas**: `Candidate` (1) ↔ (N) `SelectionProcess` (N) ↔ (1) `Vacancy`; `SelectionProcess` (1) ↔ (N) `Note` (esta última del Hito 3). Los campos son escalares tipados salvo `skills: string[]`.
- Las operaciones conocidas son: CRUD, filtros combinados (skills + seniority + availability), búsqueda por nombre/email, ordenación, paginación, agregados (conteo por estado, promedio salarial, top skills, fill rate).
- Nexova ya opera un "ATS hecho a medida de la década de 2010" (CONTEXT.md) con datos históricos; su formato es **desconocido**.

### 14.2 Lo que recomendamos [PROPUESTA]

**[PROPUESTA] Base de datos relacional, y concretamente PostgreSQL como motor recomendado** (no es una decisión tomada: ver §14.3 y §19), por estas razones ligadas al dominio, no genéricas:

1. **El modelo es relacional por naturaleza.** Candidaturas que enlazan candidato y vacante, notas que cuelgan de candidaturas, integridad referencial que hoy nadie garantiza (Elena Vargas reporta "entradas duplicadas" en la hoja de cálculo, CONTEXT-HITO3). Claves foráneas y restricciones `UNIQUE` (p. ej. email de candidato) resuelven ese problema en la capa correcta.
2. **Los reportes son agregaciones SQL clásicas.** `countCandidatesByStatus`, `calculateAverageSalary`, `calculateVacancyFillRate`, `findTopSkills` del Hito 2, y los KPIs que Dirección y RRHH piden (R5), son `GROUP BY`/`AVG`/`COUNT`. Un motor relacional los hace sin capa adicional.
3. **`skills: string[]` y matching case-insensitive.** PostgreSQL ofrece arrays nativos y `JSONB` con índices, además de búsqueda de texto y `ILIKE`/`citext` para el matching case-insensitive que `collections.ts` ya implementa en memoria. Cubre el caso sin necesitar un motor de búsqueda aparte en el MVP.
4. **Un solo motor para todos los módulos futuros.** Formación, Soporte, RRHH y Ventas son también datos relacionales (inscripciones, tickets, ausencias, deals). Con un equipo de 6 personas, un solo motor que dominar es una ventaja operativa real.
5. **Ecosistema Python/FastAPI.** El tutorial oficial de FastAPI usa SQLModel (sobre SQLAlchemy) y señala PostgreSQL como opción de producción [7]. La elección concreta de ORM y de herramienta de migraciones queda pendiente (§14.3).
6. **Preparado para lo que viene sin comprometerse ahora.** El contexto pide a futuro "RAG sobre la base de datos de candidatos" (búsqueda semántica). PostgreSQL admite extensiones vectoriales (p. ej. `pgvector`), lo que permitiría empezar sin un segundo sistema. Esto es una opción que se mantiene abierta, no una decisión.

**Criterio general para elegir motor cuando llegue el momento:** (a) ¿el modelo tiene relaciones e integridad que proteger? → relacional; (b) ¿las consultas son agregaciones y filtros combinados? → SQL; (c) ¿el equipo puede operarlo? → un motor mainstream con hosting gestionado; (d) ¿evita añadir un segundo sistema para el siguiente requisito previsible? Si alguna respuesta cambiara (p. ej. documentos sin esquema, volumen masivo de eventos), la elección se revisaría, pero **hoy no hay evidencia de eso**.

**Cómo encaja en la arquitectura:** el engine y la sesión viven en `infrastructure/db/session.py` y se inyectan como dependencia (`get_session` con `yield`, patrón oficial [7]); los repositorios de cada módulo son los únicos que ejecutan consultas; las migraciones viven en `infrastructure/db/migrations/` y son la única forma de cambiar el esquema (nunca `create_all` en producción).

### 14.3 Lo que queda pendiente de decisión [PENDIENTE]

| Decisión | Por qué no se cierra aquí |
|---|---|
| ORM: SQLAlchemy 2.x puro vs SQLModel | SQLModel unifica modelo ORM y Pydantic, lo que es cómodo pero tensiona la separación `schemas.py`/`models.py` de §8. Requiere una prueba de concepto y autorización de dependencias (regla del repo). |
| Herramienta de migraciones (Alembic es el estándar) | Depende del ORM elegido. |
| Hosting de la BD (gestionado vs propio) | Decisión de infraestructura del CTO; no hay entorno de despliegue definido. |
| Migración de datos del ATS legacy | Formato desconocido. Cuando se aborde, será un pipeline en `data/pipelines/` (convención del monorepo), no lógica del backend. |
| Estrategia de retención y borrado de datos personales de candidatos | Requiere una revisión de privacidad y protección de datos (los candidatos son personas identificables) que este documento no puede sustituir. Debe existir antes de utilizar datos reales de candidatos en un entorno accesible públicamente. |
| Base de datos de test: SQLite en memoria vs PostgreSQL efímero | Ver §16. |

---

## 15. Configuración y gestión de secretos

**[PROPUESTA]**

| Qué | Dónde vive | Cómo se lee | Versionado en git |
|---|---|---|---|
| Configuración no secreta con valor por defecto (nombre de la app, nivel de log, tamaño de página por defecto, tope de `limit`) | `core/config.py` como defaults de `Settings` | `pydantic-settings` `BaseSettings` [4] | Sí (es código) |
| Configuración que varía por entorno (`ENVIRONMENT`, `CORS_ALLOWED_ORIGINS`, `DATABASE_URL`, URLs de sistemas externos) | Variables de entorno del proceso; en local, archivo `services/api/.env` | `Settings` con `env_file=".env"` [4] | **No** el `.env`. **Sí** un `.env.example` con las claves y valores de ejemplo inocuos, para que un desarrollador nuevo sepa qué debe definir. |
| Credenciales y secretos (contraseña de BD dentro de `DATABASE_URL`, claves de API de HubSpot/Zendesk en el futuro, clave de firma de tokens cuando exista auth) | Variables de entorno inyectadas por el proveedor de despliegue o un gestor de secretos; en local, `.env` | `Settings`, tipando los secretos con `SecretStr` de Pydantic para que no aparezcan en logs ni `repr` | **Nunca.** `.gitignore` del servicio debe incluir `.env` y `.env.*` (salvo `.env.example`), igual que ya hacen los `.gitignore` de las apps Next (`.env*`) y el de la raíz (`.env`, `.env.local`). |
| Configuración pública de los frontends (URL base del backend) | `.env.local` de cada app Next (gitignored, ya es así) o variables del proveedor de deploy | `NEXT_PUBLIC_API_URL`, inlineada en build [8] | No |

Reglas:

1. **Un solo punto de lectura:** nada en `modules/` llama a `os.environ`; todo recibe `Settings` por dependencia (`get_settings()` con `lru_cache`, patrón oficial [4]). Así los tests pueden sustituir la configuración con `dependency_overrides` sin tocar el entorno.
2. **Fallo temprano:** si falta una variable obligatoria (`DATABASE_URL`, `CORS_ALLOWED_ORIGINS` en producción), `Settings` lanza en arranque, no en la primera petición. Es el mismo comportamiento que `lib/api-client.ts` del tracker ya tiene para `NEXT_PUBLIC_API_URL`.
3. **Frontend público ≠ backend secreto.** Todo lo que lleve `NEXT_PUBLIC_` acaba en el JavaScript que descarga cualquier visitante [8]. La URL del backend puede ir ahí; una clave de API jamás. Si un frontend necesita llamar a un tercero con credenciales, esa llamada pasa por el backend.
4. **Datos de negocio no son configuración.** Los datos de Nexova (nombre, CEO, departamentos) siguen la regla de trazabilidad de `.agents/rules/nexova-context.md`; si algún día se sirven por API, vendrán de la base de datos o de código citado, no de variables de entorno.

---

## 16. Testing

**[PROPUESTA]** Cuatro niveles, cada uno más caro y más lento que el anterior, con `pytest` como runner y `TestClient` (basado en HTTPX) para el nivel de API, según la documentación oficial [5].

| Nivel | Qué prueba | Sin qué | Dónde | Velocidad esperada |
|---|---|---|---|---|
| **Unitario de dominio** | `domain.py` de cada módulo: scoring, validaciones, escalas ordinales, reglas de transición de etapa | Sin BD, sin HTTP, sin `Settings` | `tests/unit/` | Milisegundos por test; cientos de tests en segundos |
| **De servicio** | `service.py`: casos de uso completos con un repositorio **falso en memoria** que implementa la misma interfaz | Sin BD real, sin HTTP | `tests/services/` | Rápido |
| **De API** | `router.py` a través de `TestClient`: códigos HTTP, formato de respuesta, mapeo de errores 404/409/422, CORS (cabeceras en un preflight `OPTIONS` desde un origen permitido y uno no permitido) | Con `dependency_overrides` para inyectar repositorios falsos o una BD de test | `tests/api/` | Medio |
| **De integración con persistencia** | `repository.py` contra una base de datos real: consultas con filtros combinados, restricciones de unicidad, migraciones aplicables desde cero | Con BD | `tests/integration/` | Lento; se ejecutan menos veces (antes de merge / en CI cuando exista) |

### 16.1 Qué hay que probar especialmente en Nexova

1. **El scoring de matching es la joya y ya tiene especificación ejecutable.** `src/tests/transformations.test.ts` (y los otros tres archivos, 97 tests en total) fijan resultados exactos con datos de ejemplo del contexto: Carolina 100 / María 92 / Juan 20; bordes de experiencia (4 y 8 → 20; ±2 años → 10; 11 → 0); salario 8400 → 5 y 8401 → 0; tope de 40 en habilidades incluyendo preferidas; no mutación; todas las claves presentes en agrupaciones. **Regla propuesta:** el módulo `matching` del backend se considera correcto solo si un conjunto de tests en `tests/unit/matching/` reproduce **uno a uno** esos casos con los mismos datos (`sampleCandidates`, `sampleVacancy` de `src/types/models.ts`) y los mismos resultados. Hasta que esa paridad exista, `src/` sigue siendo la referencia y no se retira. Esto convierte los 97 tests en un contrato entre lenguajes, no en código muerto (riesgo §17.9).
2. **Reglas de estado del pipeline.** Qué transiciones de `status`/`stage` son válidas es hoy libre en la API mock (cualquier string). Cuando Operaciones de Selección defina las transiciones, deben vivir en `pipeline/domain.py` y probarse unitariamente, no en el router.
3. **Validaciones de entrada equivalentes a `validations.ts`** (email, experiencia 0-50, salarios > 0, al menos una habilidad, rangos coherentes de vacante) y al formulario del Hito 1 (nombre con ≥2 palabras, teléfono con prefijo internacional, comentarios ≤500). Deben probarse en dominio y, además, comprobar en API que devuelven 422 con `detail[].loc` apuntando al campo, porque el tracker depende de ese formato.
4. **Contrato HTTP estable.** Tests de API que verifiquen la forma del envoltorio de paginación y del error uniforme (§10). Son los tests que protegen a los tres frontends.
5. **CORS.** Un test que envíe `OPTIONS` con `Origin` permitido y otro con `Origin` no permitido, y compruebe las cabeceras. Es barato y evita repetir la configuración inválida de la API mock.
6. **Fronteras de importación (§8.2).** Al menos un test (o un script de lint) que falle si `domain.py` importa FastAPI o SQLAlchemy.

### 16.2 Pendiente [PENDIENTE]

- BD de test: SQLite en memoria es rapidísima pero no ejerce características específicas del motor propuesto (si se confirma PostgreSQL: arrays/JSONB/`citext`); una instancia efímera del motor real (contenedor) es fiel pero exige Docker, que hoy no existe en el repo. Decisión ligada a §14.3.
- Comando de validación del subproyecto para la tabla de `AGENTS.md` (§4, paso 1): previsiblemente `pytest` + un linter/formateador Python. Se fijará al crear `services/api/` y se añadirá a esa tabla en el mismo cambio.

---

## 17. Riesgos y puntos de atención

| # | Riesgo | Qué puede ocurrir | Por qué es problemático para Nexova | Cómo lo evita esta arquitectura |
|---|---|---|---|---|
| 17.1 | **`main.py` como punto central gigante** | Empezar con "solo tres endpoints" en `main.py`; seis meses después son sesenta, con imports circulares y configuración inline. | Con seis departamentos previstos (R3), es el camino natural si nadie lo impide; y con un equipo de 6 (R1) nadie tiene tiempo para el refactor posterior. | `main.py` solo compone (§8.1); los endpoints solo pueden existir en `modules/*/router.py`; el agregador `api/v1/router.py` es el único que lista módulos. Un PR que añada un `@app.get` a `main.py` es visiblemente incorrecto. |
| 17.2 | **Lógica de negocio dentro de routers** | Calcular el scoring o validar transiciones de etapa dentro de la función del endpoint. | Imposible de reutilizar desde un job (informe semanal, R5) o desde otro módulo; solo testeable con `TestClient`, cien veces más lento que un test unitario; el Hito 2 perdería su nivel de rigor. | Capas obligatorias (§9): router → service → domain. Regla de importación 4 (§8.2). Criterio de revisión: "si necesitas `TestClient` para probar una regla, está en el sitio equivocado". |
| 17.3 | **Mezclar modelos ORM con schemas HTTP** | Devolver la fila de la tabla como respuesta JSON; aceptar el modelo de tabla como cuerpo de `POST`. | El cliente podría fijar el `id` o campos internos (razón que da el tutorial oficial [7]); cualquier cambio de columna rompe a tres frontends; datos sensibles de candidatos (salario actual) se exponen sin querer. | `schemas.py` ≠ `models.py` en cada módulo (§8.1), con `response_model` explícito en cada endpoint. El frontend solo ve `XOut`. |
| 17.4 | **Módulos por departamento sin frontera de dominio** | Crear `modules/formacion/`, `modules/ventas/` como cajones de sastre por organigrama, con un `service.py` que toca las tablas de otro módulo "porque estaba a mano". | Reproduce en código el "mosaico desconectado" que Nexova ya tiene en herramientas (R4). Además viola `.agents/rules/nexova-context.md`. | Módulos por **dominio de negocio con contexto de hito** (§7), no por departamento. Regla de importación 3: entre módulos solo `service.py`. Un departamento puede necesitar varios módulos o compartir uno. |
| 17.5 | **Microservicios demasiado pronto** | Crear un servicio para candidatos, otro para matching, otro para pipeline, "para que escale". | Tres despliegues, tres bases de datos o una compartida (peor), llamadas de red donde había llamadas a función, sin telemetría para depurarlo (R4), con 6 personas (R1). | Un solo servicio por decisión explícita (§5, §6). La modularidad interna deja abierta la extracción cuando haya una razón medible (carga, aislamiento de un componente como el RAG de soporte), no antes. |
| 17.6 | **Frontends acoplados a detalles internos** | El tracker "sabe" que `notes_count` es una columna calculada, o el backoffice construye SQL-like filters en la URL. | Cualquier optimización interna rompe UI en producción; hoy ya hay tres clientes con despliegues independientes (R6). | Contrato OpenAPI + `SPECS.md` como única dependencia (§12.3); envoltorios uniformes (§10); versionado `/api/v1` (§11) para las rupturas inevitables. |
| 17.7 | **CORS demasiado permisivo** | `allow_origins=["*"]` "para que funcione en local" y se queda en producción; o `*` + `allow_credentials=True` como la API mock actual. | Cualquier sitio web podría hacer que el navegador de un consultor autenticado llame a la API de Nexova con datos personales de candidatos; y la combinación con credenciales es inválida por especificación [6][9]. | Orígenes explícitos por entorno desde `Settings` (§13.2); `allow_credentials=False` hasta que exista auth; test de API que verifique el rechazo de un origen no listado (§16.1.5). |
| 17.8 | **Dominio acoplado al framework** | `domain.py` que importa `HTTPException`, o entidades que son modelos SQLAlchemy. | El scoring dejaría de poder testearse en milisegundos; migrar de ORM o exponer el mismo caso de uso por otro canal (CLI de `internal/`, job, agente de IA de `agents/`) exigiría reescribir. | Regla de importación 2 (§8.2): `domain.py` solo usa la librería estándar (y Pydantic para tipos, si se decide); excepciones propias en `core/errors.py` traducidas a HTTP en un solo sitio; test/lint que falle si se viola (§16.1.6). |
| 17.9 | **Duplicar reglas de scoring** | Reimplementar el scoring en Python "a ojo", con tope de habilidades distinto o salario bajo mínimo puntuando 0; o mantener dos implementaciones (TS y Python) que divergen con el tiempo. | El scoring es la ventaja competitiva de Nexova según CONTEXT.md ("la IA no apoya el producto; es la ventaja competitiva"). Dos versiones que dan 92 y 87 para el mismo candidato destruyen la confianza de los 40 consultores. | Los 97 tests de `src/tests/` se tratan como **especificación entre lenguajes**: el módulo `matching` debe reproducirlos uno a uno con los mismos datos y resultados (§16.1.1). **[PENDIENTE]** decidir el destino final de `src/` una vez alcanzada la paridad (mantener como referencia, o retirarlo). |
| 17.10 | **Mezclar la API mock actual del tracker con el backend propio** | Que el tracker apunte "a medias" al backend propio (p. ej. candidaturas en el mock y notas en el propio), o que el backend propio copie las tres formas de envoltorio del mock para "no tocar el frontend". | El tracker tiene un `SPECS.md` cuya regla es "el documento se actualiza antes que el código" y un `CLAUDE.md` que prohíbe inventar campos; un estado híbrido lo vuelve inauditable. Copiar los envoltorios inconsistentes del mock perpetúa un defecto ajeno. | El backend define su contrato limpio (§10); la migración del tracker es un **hito propio**: actualizar `SPECS.md` §4/§5 al nuevo contrato, adaptar `normalizers.ts` (único punto de cambio gracias a la frontera de confianza) y cambiar `NEXT_PUBLIC_API_URL`. Todo o nada, nunca híbrido. |
| 17.11 | **Datos personales sin control de acceso** | Desplegar el MVP sin auth en un origen público con candidatos reales para "probarlo con el equipo". | Nexova es una consultora de RRHH: CVs, salarios y teléfonos de candidatos son datos de personas identificables, y exponerlos sin control de acceso es un riesgo para la empresa y para los candidatos. Además, la lección del tracker: una API pública sin auth recibe basura de terceros (`SPECS.md` §4.2). | Hasta que exista el módulo `users/auth` (§12.5), el backend solo se despliega en entornos no públicos o con datos sintéticos. Debe existir una revisión de privacidad y protección de datos antes de utilizar datos reales de candidatos en un entorno accesible públicamente. Es una restricción operativa, no de código, y por eso se hace explícita aquí. |
| 17.12 | **Dos vocabularios de etapas en el repositorio** | Implementar `pipeline` con `ProcessStage` del Hito 2 (`Screening`…`Hired`) mientras el tracker usa `pending`…`offer_presented`, sin decidirlo. | Los consultores verían etiquetas distintas según la herramienta; el matching y el fill rate (`calculateVacancyFillRate` cuenta `"Hired"`) dependen del vocabulario. | Se marca como decisión pendiente (§19) para resolver con Operaciones de Selección **antes** de escribir `pipeline/domain.py`, y se documenta en `services/api/SPECS.md`. |

---

## 18. Decisiones propuestas

Decisiones que este documento recomienda adoptar y que, si el CTO las aprueba, deberían registrarse en `memory-bank/techContext.md` como "decisiones de arquitectura registradas":

1. **Un único servicio FastAPI** en `services/api/`, monolito modular por dominios, con capas router → service → domain → repository dentro de cada módulo (§5, §6).
2. **Módulos del MVP:** `candidates`, `vacancies`, `pipeline` (con notas), `matching` (como capacidad interna; su exposición HTTP queda pendiente, §10/§19); más `health` en `core/`. Ningún otro módulo hasta tener contexto de hito (§7).
3. **Estructura de carpetas de §8**, con `main.py` delgado, `core/`, `dependencies.py`, `api/v1/router.py` agregador, `modules/<dominio>/{router,schemas,service,domain,models,repository}.py`, `infrastructure/`, `tests/`.
4. **Reglas de importación de §8.2** como criterio de revisión de código.
5. **Convenciones FastAPI adoptadas:** `APIRouter` por módulo con `prefix`/`tags`; `include_router` en el agregador; dependencias con `Annotated[..., Depends()]`; `pydantic-settings` para configuración; `CORSMiddleware` con orígenes explícitos; `TestClient` + `pytest` (§5, §13, §15, §16).
6. **Versionado por prefijo `/api/v1`** desde el primer despliegue; `v2` solo ante ruptura real (§11).
7. **Contrato HTTP uniforme:** un envoltorio de paginación, un formato de error, 422 nativo de FastAPI, `PATCH` para cambios parciales de estado y `PUT` para reemplazos completos (convención propia del contrato de Nexova, heredada del tracker), UUID de servidor, fechas ISO 8601 UTC (§10).
8. **Frontend/backend como sistemas separados** que se comunican solo por HTTP/JSON; URL del backend exclusivamente por `NEXT_PUBLIC_API_URL` (o equivalente); frontends dependen del contrato, no de internals (§12).
9. **CORS explícito por entorno**, nunca `*` permanente, `allow_credentials=False` hasta que exista auth (§13).
10. **Base de datos relacional, con PostgreSQL como motor recomendado [PROPUESTA, pendiente de confirmar]**, acceso solo desde repositorios, esquema gestionado por migraciones; ORM, herramienta de migraciones y hosting siguen pendientes (§14.2, §14.3).
11. **Configuración y secretos solo por variables de entorno** vía `Settings`; `.env` gitignored, `.env.example` versionado; `NEXT_PUBLIC_*` solo para valores públicos (§15).
12. **Los 97 tests de `src/` son la especificación del módulo `matching`**; paridad obligatoria antes de considerar el módulo terminado (§16.1.1).
13. **`services/api/SPECS.md` se redacta antes del código**, siguiendo el precedente del tracker, y su tabla de comandos de validación se añade a `AGENTS.md` §4 en el mismo cambio que cree el servicio.
14. **Sin despliegue público con datos reales hasta que exista autenticación** (§17.11).

---

## 19. Decisiones pendientes

Decisiones que **no** deben cerrarse todavía porque falta contexto, y quién o qué las desbloquea:

| Decisión | Qué falta para cerrarla | Quién |
|---|---|---|
| Mecanismo de autenticación y modelo de roles (`users/auth`) | Un contexto de hito que diga quién usa el backoffice y qué puede hacer cada rol; decidir si se integra con Google Workspace | CTO (Sergio Molina) + stakeholders de cada área |
| ORM concreto (SQLAlchemy puro vs SQLModel) y herramienta de migraciones | Prueba de concepto + autorización de dependencias (regla de `AGENTS.md`) | CTO / tech lead |
| Gestor de dependencias Python (`uv`, `pip`+`requirements`, `poetry`) y versiones mínimas de Python/FastAPI | Decisión de tooling del equipo; no afecta a la arquitectura | Tech lead |
| Hosting del backend y de la base de datos; existencia de un entorno de staging | Decisión de infraestructura; hoy no hay ninguno definido ni Docker/CI en el repo | CTO |
| Dominios de producción de tracker/backoffice (para la lista de orígenes CORS) | Depende del hosting | CTO |
| Vocabulario único de `status`/`stage` del pipeline (Hito 2 vs Hito 3) y transiciones válidas | Validación con Operaciones de Selección (Javier Almeida) | Negocio |
| Si `matching` se expone como endpoint HTTP en el MVP o empieza como capacidad interna del backend | Un requisito de producto (p. ej. una pantalla de ranking en el tracker o el backoffice) que lo pida | Operaciones de Selección + tech lead |
| Si el pipeline propio conserva códigos legibles tipo `C-2024-0451` del ATS legacy | Conocer el ATS actual | Javier Almeida / CTO |
| Migración de datos del ATS legacy y de las hojas de cálculo | Formato de origen desconocido; sería un pipeline en `data/` | CTO + Operaciones |
| Revisión de privacidad y protección de datos (retención, borrado, acceso a datos de candidatos) | Debe existir antes de utilizar datos reales de candidatos en un entorno accesible públicamente; no hay contexto de hito ni criterio definido | Dirección / RRHH (Patricia Solís) / CTO |
| Cómo conecta `uis/website/` (estático, sin build) con `POST /candidates` | Elegir entre config generada en deploy, endpoint público con protección, o migrar el formulario | Marketing (Carmen Ruiz) + tech lead |
| Generación automática de tipos TS desde `openapi.json` en los frontends | Requiere dependencia nueva en cada app Next (prohibida sin autorización) | Tech lead |
| Base de datos de test (SQLite vs PostgreSQL efímero) | Ligada al ORM y a si se adopta Docker | Tech lead |
| Destino de `src/` (Hito 2) una vez el módulo `matching` alcance paridad | Decidir si se mantiene como referencia o se retira | Tech lead |
| Linter de fronteras de importación | Dependencia nueva; útil pero no urgente | Tech lead |
| Responsable de Ventas (Marcos Ibáñez vs Megan Clarke) | `contexts/CONTEXT.md` nombra a ambos en secciones distintas; irrelevante para el MVP, pero debe resolverse antes de cualquier módulo `sales` | Negocio |

---

## 20. Conclusión

Nexova necesita su primer sistema central: hoy su operación vive en hojas de cálculo, un ATS de 2010 y una API mock ajena que el tracker consume por falta de alternativa. La propuesta es deliberadamente sobria: **un** servicio FastAPI, organizado por los cuatro dominios que ya están modelados y probados en el repositorio (candidatos, vacantes, pipeline, matching), con capas internas que mantienen el dominio libre del framework y de la base de datos, un contrato HTTP uniforme y versionado, CORS explícito, configuración por entorno y un plan de tests que convierte los 97 tests del Hito 2 en la especificación del motor de matching.

Lo que la arquitectura **no** decide —autenticación, ORM, hosting, vocabulario de etapas, revisión de privacidad y protección de datos, exposición HTTP de `matching`— queda listado como pendiente con su desbloqueador, porque fingir que está resuelto sería la primera violación de la regla que gobierna este repositorio: no inventar lo que no está en el contexto.

El siguiente paso natural, cuando el CTO apruebe esta propuesta, es redactar `services/api/SPECS.md` (contrato de `candidates` y `vacancies` primero, que no dependen de nadie) y solo después crear el servicio, siguiendo el flujo de `AGENTS.md`: validación del subproyecto, revisión del diff, fidelidad al contexto, sincronización del `memory-bank/` y commit.

---

## Referencias

Documentación oficial consultada durante la redacción (2026-09-18):

1. FastAPI — *Bigger Applications – Multiple Files*: estructura `app/main.py`, `app/dependencies.py`, `app/routers/`; `APIRouter(prefix, tags, dependencies, responses)`; `app.include_router(...)` con `prefix`/`tags`/`dependencies` fijados al incluir; anidación `router.include_router(other_router)`. https://fastapi.tiangolo.com/tutorial/bigger-applications/
2. FastAPI — *Reference: `APIRouter` class*: "used to group path operations, for example to structure an app in multiple files"; parámetros del constructor y de `include_router`. https://fastapi.tiangolo.com/reference/apirouter/
3. FastAPI — *Dependencies*: definición de inyección de dependencias; patrón `Annotated[..., Depends()]`; usos ("share database connections", "enforce security, authentication, role requirements"); subdependencias; niveles path operation / router / global. https://fastapi.tiangolo.com/tutorial/dependencies/
4. FastAPI — *Settings and Environment Variables*: `pydantic-settings` `BaseSettings`, lectura de variables de entorno y `.env`, `get_settings()` con `@lru_cache`, override en tests. https://fastapi.tiangolo.com/advanced/settings/
5. FastAPI — *Testing*: `TestClient` basado en HTTPX, `pytest`, organización de tests en archivos separados. https://fastapi.tiangolo.com/tutorial/testing/
6. FastAPI — *CORS (Cross-Origin Resource Sharing)*: definición de origen (esquema + dominio + puerto); `CORSMiddleware`; `allow_origins`, `allow_origin_regex`, `allow_credentials`, `max_age`; prohibición de `['*']` con `allow_credentials=True`; manejo de preflight. https://fastapi.tiangolo.com/tutorial/cors/
7. FastAPI — *SQL (Relational) Databases*: SQLModel sobre SQLAlchemy + Pydantic; separación de modelos de tabla y modelos públicos (`HeroPublic`, `HeroCreate`, `HeroUpdate`) y su motivación ("deciding the `id` should be done by the backend or the database, not by the client"); dependencia `get_session` con `yield`; PostgreSQL como opción de producción. https://fastapi.tiangolo.com/tutorial/sql-databases/
8. Next.js — *How to use environment variables*: `NEXT_PUBLIC_` se inlinea en el bundle del navegador en tiempo de build; las variables sin prefijo solo existen en el entorno Node; `.env*` no deben comitearse. https://nextjs.org/docs/app/guides/environment-variables
9. MDN — *Cross-Origin Resource Sharing (CORS)*: same-origin policy para `fetch()`; peticiones preflight `OPTIONS` y qué las dispara (métodos distintos de GET/HEAD/POST, `Content-Type: application/json`); prohibición de `*` en `Access-Control-Allow-Origin` con credenciales. https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS

Fuentes internas del repositorio en las que se apoya cada afirmación marcada **[HECHO]**:

- `memory-bank/projectbrief.md`, `memory-bank/techContext.md`, `memory-bank/progress.md`
- `AGENTS.md`, `.agents/rules/monorepo-structure.md`, `.agents/rules/nexova-context.md`, `.agents/rules/app-specific-overrides.md`
- `contexts/CONTEXT.md`, `contexts/hito1/CONTEXT-WEB-NEXOVA.md`, `contexts/hito2/CONTEXT-HITO2.md`, `contexts/hito3/CONTEXT-HITO3.md` (carpeta local, no versionada)
- `src/types/models.ts`, `src/utils/*.ts`, `src/tests/*.test.ts`
- `uis/talent-pipeline-tracker/SPECS.md`, `CLAUDE.md`, `README.md`, `lib/api-client.ts`, `services/normalizers.ts`
- `uis/backoffice/CLAUDE.md`, `README.md`, `lib/company.ts`
- `uis/website/src/js/validations.js`
