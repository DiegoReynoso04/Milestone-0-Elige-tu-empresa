"""Formato de error único `{"detail": str, "code": str}` y su traducción.

Ninguna respuesta de error incluye datos enviados por el cliente: el CSV puede
contener emails reales (ver docs/COMPANY_INCIDENT_FILE_ANALIZER_PROJECT.md).
"""

import logging
from collections.abc import Mapping
from http import HTTPStatus

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger("nexova.api")

INTERNAL_ERROR_DETAIL = "internal server error"
# Campos de los errores de validación que se devuelven. Se descartan `input`,
# `ctx` y `url`: `input` reproduce el valor recibido (p. ej. un CSV pegado
# como texto) y `ctx` puede contener partes de él.
_VALIDATION_ERROR_KEYS = ("loc", "msg", "type")


class ApiError(HTTPException):
    """Error de la API con código estable. `detail` nunca contiene datos del archivo.

    Hereda de `fastapi.HTTPException` porque FastAPI solo deja propagar esa
    clase si se lanza mientras lee el body; cualquier otra la convierte en 400.
    """

    code: str = "error"

    def __init__(self, status_code: int, code: str, detail: str) -> None:
        super().__init__(status_code=status_code, detail=detail)
        self.code = code


class InvalidCsvError(ApiError):
    def __init__(self, detail: str) -> None:
        super().__init__(400, "invalid_csv", detail)


class NoAnalysisError(ApiError):
    def __init__(self) -> None:
        super().__init__(404, "no_analysis", "no analysis available yet")


class FileTooLargeError(ApiError):
    def __init__(self, max_bytes: int) -> None:
        super().__init__(413, "file_too_large", f"request body exceeds the {max_bytes} bytes limit")


class UnsupportedFileTypeError(ApiError):
    def __init__(self) -> None:
        super().__init__(415, "unsupported_file_type", "only .csv files are accepted")


def error_response(
    status_code: int, code: str, detail: object, headers: Mapping[str, str] | None = None
) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"detail": detail, "code": code}, headers=headers)


async def _http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    # Las cabeceras de la excepción se conservan (p. ej. `Allow` en un 405,
    # obligatoria según RFC 9110).
    if isinstance(exc, ApiError):
        return error_response(exc.status_code, exc.code, exc.detail, exc.headers)
    # Errores de Starlette/FastAPI (404 de ruta, 405, multipart ilegible...):
    # se responde con la frase estándar del código, no con `exc.detail`.
    status = HTTPStatus(exc.status_code)
    code = status.phrase.lower().replace(" ", "_").replace("-", "_")
    return error_response(status.value, code, status.phrase, exc.headers)


async def _validation_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    errors = [{key: error[key] for key in _VALIDATION_ERROR_KEYS if key in error} for error in exc.errors()]
    return error_response(422, "validation_error", errors)


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, _http_exception_handler)
    app.add_exception_handler(RequestValidationError, _validation_exception_handler)


class InternalErrorMiddleware:
    """Convierte cualquier excepción no controlada en un 500 opaco.

    Es un middleware y no un `exception_handler(Exception)` porque Starlette,
    tras ejecutar ese handler, relanza la excepción y el servidor registra la
    traza con su mensaje, que podría contener datos del archivo. Aquí solo se
    registra el nombre de la clase.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        response_started = False

        async def tracking_send(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, receive, tracking_send)
        except Exception as exc:  # noqa: BLE001 — frontera final del proceso
            logger.error("unhandled error while processing request: %s", type(exc).__name__)
            if not response_started:
                response = error_response(500, "internal_error", INTERNAL_ERROR_DETAIL)
                await response(scope, receive, send)
