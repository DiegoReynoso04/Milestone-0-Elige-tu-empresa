# `services` folder

This folder contains **all the backend services** (APIs and background workers) related to the company for the cross-functional AI Engineering project.

Each subfolder inside `services/` must correspond to **one specific service** (for example: `admin-api`, `data-processor-worker`) and include its own technical and functional documentation.

- **Main purpose**: to centralize all the backend logic, APIs, and queue consumers that support the company's use cases.
- **Recommendation**: document in this file (or in sub-READMEs) the services you add, their objective, the technology used, and how to run them.

## Services in this repository

| Service | Path | Objective | Stack | Status |
|---|---|---|---|---|
| Nexova API | [`api/`](./api/README.md) | Single FastAPI app: (1) HTTP layer over `packages/incident-analyzer` for Nexova's support-ticket CSV analysis (Customer Support, Roberto Díaz); (2) supplier directory `/suppliers` persisted in TinyDB, with `uv run seed` (Patricia Solís, HR). Local use only, no authentication | Python 3.11+, FastAPI, Pydantic, TinyDB, uvicorn | Phase 2 of the incident analyzer; lightweight storage API (`docs/ligthweight-storage-api.md`) |

> _Spanish version: [README.es.md](./README.es.md)._
