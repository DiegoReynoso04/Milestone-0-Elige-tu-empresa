# services/api — API del analizador de incidentes (Nexova)

API HTTP (FastAPI) que expone el análisis del CSV de incidentes de soporte de Nexova (Atención al Cliente — Roberto Díaz). Es una **capa fina** sobre el núcleo [`packages/incident-analyzer`](../../packages/incident-analyzer/README.md): no contiene reglas, métricas, redondeo ni formato de exportación propios. La CLI [`scripts/analyze.py`](../../scripts/analyze.py) usa el mismo núcleo, así que el mismo CSV da los mismos números por ambas vías.

- Contrato HTTP, errores y decisiones: [`SPECS.md`](./SPECS.md).
- Requisitos funcionales: [`docs/COMPANY_INCIDENT_FILE_ANALIZER_PROJECT.md`](../../docs/COMPANY_INCIDENT_FILE_ANALIZER_PROJECT.md). Ese documento no define ninguna API: las rutas son una decisión de implementación (ver `SPECS.md` §2).

> ⚠️ **Uso local únicamente.** No hay autenticación. No exponer este servicio públicamente con datos reales.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/incidents/analyze` | Analiza un CSV (`multipart/form-data`, campo `file`) y devuelve las métricas en JSON |
| `GET` | `/api/incidents/results/export` | Descarga `results.csv` (`metric,value`) del último análisis |
| `GET` | `/health` | Liveness |

Documentación interactiva de FastAPI en `http://localhost:8000/docs` con el servidor arrancado.

## Requisitos

Python 3.11 o superior (verificado con 3.14.6). Dependencias (`pyproject.toml`), acotadas a las versiones probadas y sin lockfile: `fastapi>=0.141,<0.142`, `python-multipart>=0.0.32,<0.1`, `uvicorn>=0.53,<0.54` y, para tests (extra `dev`), `httpx>=0.28,<0.29`. Sin pytest ni librerías de configuración.

## Instalación (desde la raíz del monorepo)

```bash
python -m venv services/api/.venv
# Windows (PowerShell):  services\api\.venv\Scripts\Activate.ps1
# Linux/macOS:           source services/api/.venv/bin/activate
python -m pip install -e packages/incident-analyzer -e "services/api[dev]"
```

**Instalar siempre los dos en la misma orden.** El núcleo (`packages/incident-analyzer`) no está publicado y **no** figura en las dependencias de `pyproject.toml` a propósito: su nombre está libre en PyPI y declararlo haría que pip lo buscase allí (*dependency confusion*). `pip install -e "services/api[dev]"` a solas instala el servicio pero no el núcleo, y la API fallará al importar `incident_analyzer`. `.venv/` y `*.egg-info/` están en `.gitignore`.

## Arranque

```bash
cd services/api
uvicorn app.main:create_app --factory --port 8000 --workers 1
```

**Siempre con un único worker**: el último análisis vive en memoria del proceso.

### Configuración

Variables de entorno (la API **no** carga archivos `.env`; [`.env.example`](./.env.example) solo las documenta):

| Variable | Por defecto | Uso |
|---|---|---|
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` | Orígenes permitidos, separados por comas. `*` se rechaza al arrancar |
| `MAX_UPLOAD_BYTES` | `1048576` (1 MiB) | Límite técnico del **body HTTP completo** (CSV + cabeceras y delimitadores multipart), **no del CSV**: el CSV máximo es algo menor. Decisión de la API, no requisito del cliente. Detalle en `SPECS.md` §3.1 |

```powershell
$env:CORS_ALLOWED_ORIGINS = "http://localhost:3000,http://localhost:3001"
```

## Limitaciones conocidas (deliberadas en esta fase)

- **El último análisis se pierde al reiniciar** el proceso: no hay persistencia.
- Se guarda **el último análisis que termina correctamente**; un POST fallido no lo cambia. Es **global al proceso**, no por usuario, y con peticiones concurrentes gana la que termina después. `X-Analysis-Id` en la exportación identifica el análisis descargado.
- **Sin autenticación**: servicio local.
- Con `MAX_UPLOAD_BYTES` > 1 MiB, Starlette puede volcar el archivo subido a un temporal en disco durante la petición.
- Las respuestas 200 de análisis y exportación llevan `Cache-Control: no-store`.

## Tests

La suite necesita las dependencias del venv de `services/api` (con el Python global falla al importar `fastapi`). Desde la raíz del monorepo, **sin necesidad de activar el venv**, usando su intérprete directamente:

```bash
# Windows
services\api\.venv\Scripts\python -m unittest discover -s services/api/tests -t services/api
# Linux/macOS
services/api/.venv/bin/python -m unittest discover -s services/api/tests -t services/api
```

Equivalente con el venv activado: `python -m unittest discover -s services/api/tests -t services/api`.

La suite del núcleo (Fase 1) no necesita el venv: `python -m unittest discover -s packages/incident-analyzer/tests -t packages/incident-analyzer` con cualquier Python ≥ 3.11.

| Archivo | Qué cubre |
|---|---|
| `test_analyze.py` | POST correcto, contrato JSON, orden de reglas/categorías/estados, paridad con el núcleo, `/health` |
| `test_export.py` | 404 sin análisis, cabeceras, cuerpo idéntico al `results.csv` de la CLI, sustitución A→B, B fallido (400/413/415/422/500) no borra A, `Cache-Control: no-store` |
| `test_errors.py` | 400/404/405 (con `Allow`)/413/415/422, límite con y sin `Content-Length` incluida la frontera exacta (`MAX` → 200, `MAX+1` → 413), ausencia de volcado a disco, configuración, CORS |
| `test_privacy.py` | Ningún email ni dato de registro en respuestas, errores, export ni logs; 500 opaco con excepción que contiene un email |
| `test_architecture.py` | La API no duplica reglas, categorías, estados, regex, lógica de score ni redondeo; solo usa la API pública del núcleo; el núcleo no importa FastAPI |

Los tests reutilizan el fixture sintético del núcleo (`example.invalid`). El núcleo tiene su propia suite (ver su README).

**Aviso conocido:** Starlette 1.7 emite `StarletteDeprecationWarning` recomendando `httpx2` para `TestClient`. Se mantiene `httpx` (la dependencia autorizada); los tests pasan igual.

## Estructura

```text
app/
├── main.py                  # create_app(): middlewares, handlers, routers, /health
├── core/
│   ├── config.py            # Settings desde variables de entorno (stdlib)
│   ├── errors.py            # formato {detail, code}, 422 saneado, middleware de 500 opaco
│   └── limits.py            # límite del body (Content-Length + conteo en streaming)
└── modules/incidents/
    ├── router.py            # 2 endpoints: request → servicio → respuesta
    ├── schemas.py           # contrato JSON (traducción de AnalysisResult, sin cálculo)
    ├── service.py           # extensión .csv, llamada al núcleo, guardado del resultado
    └── store.py             # LastResultStore (memoria, thread-safe)
tests/
```
