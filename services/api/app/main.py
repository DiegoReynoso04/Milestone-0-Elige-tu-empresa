"""Aplicación FastAPI. Arranque: `uvicorn app.main:create_app --factory` (ver README).

Solo ensambla: configuración, middlewares, handlers de error y routers.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import Settings
from app.core.errors import InternalErrorMiddleware, install_error_handlers
from app.core.limits import BodySizeLimitMiddleware
from app.modules.incidents.router import router as incidents_router
from app.modules.incidents.store import LastResultStore


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings if settings is not None else Settings.from_env()

    app = FastAPI(title="Nexova Incident Analyzer API", version="0.1.0")
    app.state.settings = settings
    # Un store por app: cada create_app() (y cada test) empieza sin análisis.
    app.state.result_store = LastResultStore()

    install_error_handlers(app)
    app.include_router(incidents_router, prefix="/api/incidents")

    @app.get("/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    # add_middleware apila hacia fuera: el último añadido es el más externo.
    # Orden resultante: CORS → errores internos (500) → límite de body → app.
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_upload_bytes)
    app.add_middleware(InternalErrorMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_allowed_origins),
        allow_methods=["GET", "POST"],
        allow_credentials=False,
        expose_headers=["Content-Disposition", "X-Analysis-Id"],
    )
    return app
