# SPECS — API del analizador de incidentes (Nexova)

Contrato HTTP de `services/api`. Si el código y este documento discrepan, el documento se actualiza en el mismo cambio que el código.

Este documento distingue **dos orígenes** de requisitos. Mezclarlos sería atribuir al cliente decisiones que no tomó.

---

## 1. Requisitos funcionales heredados (contexto de Nexova)

Fuente: [`docs/COMPANY_INCIDENT_FILE_ANALIZER_PROJECT.md`](../../docs/COMPANY_INCIDENT_FILE_ANALIZER_PROJECT.md). La API **no** los reimplementa: los aplica el núcleo [`packages/incident-analyzer`](../../packages/incident-analyzer/README.md), el mismo que usa la CLI `scripts/analyze.py`.

| Requisito | Dónde se cumple |
|---|---|
| Estructura del CSV (9 campos, UTF-8, cabecera, coma) | `incident_analyzer` (`schema.py`, `reader.py`) |
| Las 7 reglas de registros inválidos y su recuento por regla | `incident_analyzer` (`validation.py`, `metrics.py`) |
| Métricas: totales, desglose por categoría y por estado sobre válidos, índice de satisfacción de CLOSED | `incident_analyzer` (`metrics.py`) |
| Exportación "una métrica por fila" | `incident_analyzer` (`export.py`, formato `metric,value`) |
| Privacidad: `customer_email` nunca en ninguna salida, "ni siquiera en errores"; nada de enviar datos a herramientas de IA externas | núcleo (solo conteos) + API (§5 de este documento) |

Las decisiones de interpretación del contexto (D1–D9: conteo por regla, `strip()`, `AGT-\d{2}`, scores no enteros, etc.) están documentadas en el README del núcleo y rigen igual para la API.

---

## 2. Decisiones de API (de esta implementación, no del contexto)

El documento de contexto de Nexova **no define ninguna API HTTP**: describe un script de consola. Todo lo de esta sección son decisiones del tech lead para la Fase 2 del proyecto (rama `feature/incident-analyzer`), registradas también en `memory-bank/`.

| ID | Decisión |
|---|---|
| D-API-1 | Rutas `POST /api/incidents/analyze` y `GET /api/incidents/results/export`. **Sin** prefijo `/api/v1` (a diferencia de `docs/ARCHITECTURE_PROPOSAL.md`, que sigue siendo una propuesta pendiente) |
| D-API-2 | Porcentajes y media de satisfacción como **string decimal** (`"29.2"`, `"3.84"`), `null` si no son calculables. El redondeo lo hace solo el núcleo |
| D-API-3 | Tests con `unittest` + `fastapi.testclient.TestClient` (sin pytest) |
| D-API-4 | Límite técnico `MAX_UPLOAD_BYTES`, por defecto **1 MiB (1048576 bytes)**, aplicado al **body HTTP completo** (cabeceras y delimitadores multipart incluidos), **no al CSV**. No es un requisito del cliente. Ver §3.1 "Límite de tamaño" |
| D-API-5 | El último resultado es **el último análisis que termina correctamente**; un POST fallido no lo modifica |
| D-API-11 | `Cache-Control: no-store` en las respuestas 200 de `POST /api/incidents/analyze` y `GET /api/incidents/results/export` |
| D-API-6 | `analysis_id` y `analyzed_at` en la respuesta del POST; `X-Analysis-Id` en el GET de exportación. Son metadatos de la API: no forman parte de `AnalysisResult` |
| D-API-7 | CORS con orígenes explícitos (`CORS_ALLOWED_ORIGINS`, por defecto `http://localhost:3000`), solo `GET`/`POST`, sin credenciales, nunca `*` |
| D-API-8 | `GET /health` fuera de `/api` |
| D-API-9 | El núcleo expone `analyze_binary_stream(stream)`; la API le pasa `UploadFile.file` |
| D-API-10 | **Sin autenticación.** Servicio de uso **local**; no apto para exponerse públicamente con datos reales |

---

## 3. Endpoints

### 3.1 `POST /api/incidents/analyze`

**Petición:** `multipart/form-data` con un único campo obligatorio **`file`**.

- Se acepta si el nombre del archivo termina en `.csv` (sin distinguir mayúsculas). El `Content-Type` de la parte **no** se usa para decidir (Windows envía `application/vnd.ms-excel`, otros navegadores `text/plain`).
- La validez del contenido la decide el núcleo: UTF-8 con BOM opcional, CRLF o LF, cabecera con las 9 columnas.
- Un archivo con solo la cabecera es un análisis válido: 200 con todos los conteos a 0 y porcentajes/media `null`.

**Límite de tamaño (D-API-4) — body HTTP, no CSV:**

- Se limita el **body HTTP completo** de la petición: el CSV **más** las cabeceras de la parte multipart (`Content-Disposition`, `Content-Type`) y los delimitadores (`--boundary`). Un body de exactamente `MAX_UPLOAD_BYTES` se acepta; uno de `MAX_UPLOAD_BYTES + 1` recibe 413.
- Por tanto el CSV máximo es **algo menor** que `MAX_UPLOAD_BYTES`: con 1 MiB, un CSV de exactamente 1 048 576 bytes se rechaza. La sobrecarga multipart depende del cliente (nombre del archivo, boundary): ~150 bytes en los tests, algo más en navegadores. Un frontend que quiera avisar antes de subir debe dejar margen (p. ej. rechazar CSV > 1 MiB − 4 KiB) y, en cualquier caso, tratar el 413 del servidor.
- Se aplica con y sin `Content-Length`: si la cabecera declara más del límite → 413 inmediato sin leer el body; si no la hay → se cuentan los bytes recibidos y se corta al superar el límite.
- Motivo: con el body ≤ 1 MiB, la parte del archivo nunca supera el umbral (1 MiB) a partir del cual Starlette la vuelca a un temporal en disco. Así un CSV con emails reales no toca disco (lo verifica un test).

**Respuesta 200** (`application/json`, `Cache-Control: no-store`):

```json
{
  "analysis_id": "7d3e0c2a-5b1f-4a57-9d0e-2f4c1b8a6e10",
  "analyzed_at": "2026-09-23T10:15:00Z",
  "totals": { "total_records": 13, "valid_records": 8, "invalid_records": 5 },
  "invalid_breakdown": [
    { "code": "missing_client_company", "label": "Missing client_company", "count": 2 },
    { "code": "invalid_category", "label": "Invalid or missing category", "count": 1 },
    { "code": "invalid_description", "label": "Invalid or missing description", "count": 1 },
    { "code": "invalid_agent_id", "label": "Invalid or missing agent_id", "count": 1 },
    { "code": "invalid_email", "label": "Invalid or missing email", "count": 2 },
    { "code": "closed_without_score", "label": "Closed ticket, no score", "count": 1 },
    { "code": "score_out_of_range", "label": "Score out of range", "count": 1 }
  ],
  "categories": [
    { "code": "TECHNICAL", "count": 2, "percentage": "25.0" },
    { "code": "BILLING", "count": 2, "percentage": "25.0" },
    { "code": "ACCESS", "count": 1, "percentage": "12.5" },
    { "code": "HR_QUERY", "count": 1, "percentage": "12.5" },
    { "code": "COMPLAINT", "count": 2, "percentage": "25.0" }
  ],
  "statuses": [
    { "code": "OPEN", "count": 2, "percentage": "25.0" },
    { "code": "CLOSED", "count": 4, "percentage": "50.0" },
    { "code": "DISCARDED", "count": 1, "percentage": "12.5" }
  ],
  "satisfaction": {
    "closed_tickets": 4,
    "scored_tickets": 4,
    "average_score": "3.75",
    "distribution": [
      { "score": 1, "label": "Very dissatisfied", "count": 0 },
      { "score": 2, "label": "Dissatisfied", "count": 1 },
      { "score": 3, "label": "Neutral", "count": 0 },
      { "score": 4, "label": "Satisfied", "count": 2 },
      { "score": 5, "label": "Very satisfied", "count": 1 }
    ]
  },
  "export": {
    "available": true,
    "url": "/api/incidents/results/export",
    "filename": "results.csv",
    "format": "metric,value"
  }
}
```

(Valores del fixture sintético `packages/incident-analyzer/tests/fixtures/incidents-synthetic.csv`.)

Garantías del contrato:

- Siempre las **7 reglas, 5 categorías, 3 estados y puntuaciones 1–5**, en el orden del núcleo (el del documento de contexto), aunque valgan 0.
- `invalid_records` cuenta filas; `invalid_breakdown` cuenta activaciones de regla (una fila puede activar varias), así que la suma del desglose puede ser mayor que `invalid_records`.
- Los conteos de `statuses` pueden sumar menos que `valid_records`: un válido con un status fuera de `OPEN`/`CLOSED`/`DISCARDED` no invalida la fila (D3) ni aparece en el desglose.
- Etiquetas (`label`) y códigos vienen del núcleo: el frontend no debe duplicarlos.
- **Nunca** contiene filas ni valores de registros: ni `customer_email`, ni `description`, `ticket_id`, `agent_id` o `client_company`. Tampoco el nombre del archivo subido.

### 3.2 `GET /api/incidents/results/export`

Devuelve el último análisis correcto del proceso como CSV.

| | |
|---|---|
| Estado | `200` |
| `Content-Type` | `text/csv; charset=utf-8` |
| `Content-Disposition` | `attachment; filename="results.csv"` |
| `X-Analysis-Id` | `analysis_id` del análisis exportado (expuesto por CORS para que el frontend lo lea) |
| `Cache-Control` | `no-store` (la URL es fija y el contenido cambia con cada análisis) |
| Cuerpo | `render_results_csv(AnalysisResult)` del núcleo: **byte a byte** lo mismo que escribe la CLI en `results.csv` (`metric,value`, una métrica por fila, CRLF) |

Sin análisis previo: `404` `{"detail": "no analysis available yet", "code": "no_analysis"}`.

### 3.3 `GET /health`

`200` `{"status": "ok"}`. Técnico, fuera de `/api`, sin datos.

---

## 4. Errores

Formato único: `{"detail": ..., "code": "..."}`.

| HTTP | `code` | Cuándo | `detail` |
|---|---|---|---|
| 400 | `invalid_csv` | archivo vacío, sin cabecera, faltan columnas, no es UTF-8, CSV ilegible | mensaje del núcleo (solo nombres de columna o números de fila) |
| 404 | `no_analysis` | export sin análisis previo | `no analysis available yet` |
| 404 | `not_found` | ruta inexistente | `Not Found` |
| 405 | `method_not_allowed` | método no soportado; incluye la cabecera `Allow` con los métodos permitidos | `Method Not Allowed` |
| 413 | `file_too_large` | **body HTTP** mayor que `MAX_UPLOAD_BYTES` (por `Content-Length` o contando bytes en streaming si no hay `Content-Length`) | `request body exceeds the <N> bytes limit` |
| 415 | `unsupported_file_type` | el nombre no termina en `.csv` | `only .csv files are accepted` (no repite el nombre) |
| 422 | `validation_error` | falta el campo `file`, otro nombre de campo, cuerpo JSON, `file` enviado como texto | lista de `{loc, msg, type}`. Se eliminan `input`, `ctx` y `url` del formato nativo de FastAPI |
| 400 | `bad_request` | multipart ilegible (error del parser de Starlette) | `Bad Request` |
| 500 | `internal_error` | cualquier excepción no prevista | `internal server error` — sin mensaje, tipo ni traza |

---

## 5. Privacidad (obligatoria)

- **Datos de registros:** la API solo maneja `AnalysisResult`, que contiene conteos, enums y etiquetas fijas. No hay forma de que un valor de una fila llegue a una respuesta.
- **Errores:** los `detail` son textos fijos o mensajes del núcleo que solo citan columnas y números de fila. El 422 no reproduce lo enviado (`input`/`ctx`/`url` eliminados). El 415 no repite el nombre del archivo.
- **500:** un middleware propio captura la excepción y responde el cuerpo fijo. **No** se usa `exception_handler(Exception)`, porque Starlette relanza la excepción tras ejecutarlo y el servidor registraría la traza con su mensaje. Solo se registra el **nombre de la clase** de la excepción.
- **Logs:** no se registran bodies, filas ni mensajes de excepción. El access log de uvicorn registra método, ruta y estado.
- **Disco:** con el límite por defecto (1 MiB) el upload nunca pasa a un archivo temporal. Si se sube `MAX_UPLOAD_BYTES` por encima de 1 MiB, Starlette puede volcar a disco temporal el archivo durante la petición.
- **Estado:** el último resultado guarda solo `AnalysisResult` + `analysis_id` + `analyzed_at`. Ni el CSV ni sus bytes.

---

## 6. Estado del último análisis

`LastResultStore` (en memoria, `threading.Lock`), creado por `create_app()` en `app.state`.

- **Qué guarda:** **el último análisis que termina correctamente.** Un POST que falla (400, 413, 415, 422, 500) no lo modifica. Con peticiones concurrentes gana la que *termina* después, no la que empezó después (no se ordena por hora de inicio).
- **No es persistencia:** se pierde al reiniciar el proceso.
- **Global al proceso**, no por usuario: cualquier análisis correcto posterior (de cualquiera) reemplaza al anterior. `X-Analysis-Id` permite comprobar qué análisis se descarga.
- **Un único worker:** con varios workers cada proceso tendría su propio "último análisis".
- Sustituible por persistencia sin tocar el router: el servicio solo usa `save()` y `latest()`.

---

## 7. Configuración

Variables de entorno del proceso (la API no carga archivos `.env`; ver `.env.example`):

| Variable | Por defecto | Validación |
|---|---|---|
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` | lista separada por comas; `*` se rechaza al arrancar |
| `MAX_UPLOAD_BYTES` | `1048576` | entero > 0; se valida al arrancar. Límite del **body HTTP completo**, no del CSV (§3.1) |
