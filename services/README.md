# `services` folder

This folder contains **all the backend services** (APIs and background workers) related to the company for the cross-functional AI Engineering project.

Each subfolder inside `services/` must correspond to **one specific service** (for example: `admin-api`, `data-processor-worker`) and include its own technical and functional documentation.

- **Main purpose**: to centralize all the backend logic, APIs, and queue consumers that support the company's use cases.
- **Recommendation**: document in this file (or in sub-READMEs) the services you add, their objective, the technology used, and how to run them.

## Services in this repository

| Service | Path | Objective | Stack | Status |
|---|---|---|---|---|
| Incident analyzer API | [`api/`](./api/README.md) | HTTP layer over `packages/incident-analyzer` for Nexova's support-ticket CSV analysis (Customer Support, Roberto Díaz). Local use only, no authentication | Python 3.11+, FastAPI, uvicorn | Phase 2 of the incident analyzer |

> _Spanish version: [README.es.md](./README.es.md)._
