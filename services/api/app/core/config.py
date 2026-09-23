"""Configuración del servicio, leída una sola vez de variables de entorno.

Sin pydantic-settings ni python-dotenv (no autorizados): la API no carga
archivos `.env`; `.env.example` solo documenta las variables.
"""

import os
from collections.abc import Mapping
from dataclasses import dataclass

DEFAULT_CORS_ALLOWED_ORIGINS = ("http://localhost:3000",)
# 1 MiB. Decisión técnica de esta API (D-API-4), no un requisito del contexto
# de Nexova. Con este valor el multipart nunca supera el umbral a partir del
# cual Starlette vuelca el archivo a disco (SpooledTemporaryFile de 1 MiB).
DEFAULT_MAX_UPLOAD_BYTES = 1024 * 1024


class ConfigError(ValueError):
    """Variable de entorno inválida. Se lanza al arrancar, no en una petición."""


@dataclass(frozen=True, slots=True)
class Settings:
    cors_allowed_origins: tuple[str, ...] = DEFAULT_CORS_ALLOWED_ORIGINS
    max_upload_bytes: int = DEFAULT_MAX_UPLOAD_BYTES

    def __post_init__(self) -> None:
        if "*" in self.cors_allowed_origins:
            raise ConfigError("CORS_ALLOWED_ORIGINS must list explicit origins; '*' is not allowed")
        if self.max_upload_bytes <= 0:
            raise ConfigError("MAX_UPLOAD_BYTES must be a positive integer")

    @classmethod
    def from_env(cls, environ: Mapping[str, str] = os.environ) -> "Settings":
        origins = environ.get("CORS_ALLOWED_ORIGINS")
        max_upload = environ.get("MAX_UPLOAD_BYTES")
        try:
            max_upload_bytes = int(max_upload) if max_upload is not None else DEFAULT_MAX_UPLOAD_BYTES
        except ValueError:
            raise ConfigError("MAX_UPLOAD_BYTES must be a positive integer") from None
        return cls(
            cors_allowed_origins=(
                tuple(origin.strip() for origin in origins.split(",") if origin.strip())
                if origins is not None
                else DEFAULT_CORS_ALLOWED_ORIGINS
            ),
            max_upload_bytes=max_upload_bytes,
        )
