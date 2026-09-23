# Carpeta `services`

Esta carpeta contiene **todos los servicios backend** (APIs y workers en segundo plano) relacionados con la compañía para el proyecto transversal de AI Engineering.

Cada subcarpeta dentro de `services/` debe corresponder a **un servicio concreto** (por ejemplo `admin-api`, `data-processor-worker`) e incluir su propia documentación técnica y funcional.

- **Propósito principal**: centralizar toda la lógica backend, APIs y consumidores de colas que dan soporte a los casos de uso de la compañía.
- **Recomendación**: documenta en este archivo (o en sub-READMEs) los servicios que vayas añadiendo, su objetivo, tecnología usada y cómo ejecutarlos.

## Servicios en este repositorio

| Servicio | Ruta | Objetivo | Stack | Estado |
|---|---|---|---|---|
| API del analizador de incidentes | [`api/`](./api/README.md) | Capa HTTP sobre `packages/incident-analyzer` para el análisis del CSV de tickets de soporte de Nexova (Atención al Cliente, Roberto Díaz). Solo uso local, sin autenticación | Python 3.11+, FastAPI, uvicorn | Fase 2 del analizador de incidentes |
