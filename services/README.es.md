# Carpeta `services`

Esta carpeta contiene **todos los servicios backend** (APIs y workers en segundo plano) relacionados con la compañía para el proyecto transversal de AI Engineering.

Cada subcarpeta dentro de `services/` debe corresponder a **un servicio concreto** (por ejemplo `admin-api`, `data-processor-worker`) e incluir su propia documentación técnica y funcional.

- **Propósito principal**: centralizar toda la lógica backend, APIs y consumidores de colas que dan soporte a los casos de uso de la compañía.
- **Recomendación**: documenta en este archivo (o en sub-READMEs) los servicios que vayas añadiendo, su objetivo, tecnología usada y cómo ejecutarlos.

## Servicios en este repositorio

| Servicio | Ruta | Objetivo | Stack | Estado |
|---|---|---|---|---|
| API de Nexova | [`api/`](./api/README.md) | Una sola app FastAPI: (1) capa HTTP sobre `packages/incident-analyzer` para el análisis del CSV de tickets de soporte de Nexova (Atención al Cliente, Roberto Díaz); (2) directorio de proveedores `/suppliers` persistido en TinyDB, con `uv run seed` (Patricia Solís, RRHH). Solo uso local, sin autenticación | Python 3.11+, FastAPI, Pydantic, TinyDB, uvicorn | Fase 2 del analizador de incidentes; API de almacenamiento ligero (`docs/ligthweight-storage-api.md`) |
