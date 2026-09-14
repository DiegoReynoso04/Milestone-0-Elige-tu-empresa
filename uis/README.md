# `uis` folder

This folder contains **all projects with a user interface** for the cross-functional AI Engineering company project — for example: a public website, admin dashboard frontend, ecommerce UI, customer portals, Streamlit/Gradio app or other frontend-only tools.

The two main projects stored here are:

- **`website`** — the company's public-facing web presence.
- **`backoffice`** — the internal admin application. This is the ideal place to develop multiple solutions within a single project: authentication, people management, operations management, internal communication, and other back-office capabilities.

Organize `uis/` by **different concerns** — each subfolder covers a distinct area of the company (for example, public web vs internal operations) and includes its own technical and functional documentation.

- **Main purpose**: to centralize in a single place all frontend applications that support the company's use cases.
- **Recommendation**: document in this file (or in sub-READMEs) the applications you add, their objective, the technology used, and how to run them.

## Applications in this repository

| App | Path | Objective | Stack | Status |
|---|---|---|---|---|
| Website | [`website/`](./website/) | Public landing + talent registration form (Marketing, Carmen Ruiz) | Static HTML + Tailwind CSS v4 (Play CDN), no build step | Live (Milestone 1, deployed on Netlify) |
| Talent Pipeline Tracker | [`talent-pipeline-tracker/`](./talent-pipeline-tracker/README.md) | Internal candidate-selection panel (Selection Operations, Javier Almeida) | Next.js 16 (App Router) + React 19 + strict TypeScript + Tailwind v4 | Done (Milestone 3) |
| Backoffice | [`backoffice/`](./backoffice/README.md) | Internal admin entry point for Nexova's operations — see its README for scope | Next.js 16 + React 19 + strict TypeScript + Tailwind v4 (same stack as `talent-pipeline-tracker`, see [`memory-bank/techContext.md`](../memory-bank/techContext.md)) | Scaffold — entry view with real company data, no business logic yet |

> _Estas instrucciones también están disponibles en [español](./README.es.md)._
