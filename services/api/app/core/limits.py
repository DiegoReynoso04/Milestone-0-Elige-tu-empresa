"""Límite de tamaño del body de la petición (MAX_UPLOAD_BYTES).

El límite se aplica al body completo (multipart incluido), así que el archivo
siempre es algo menor que MAX_UPLOAD_BYTES. Dos barreras:

1. `Content-Length` mayor que el límite → 413 inmediato, sin leer el body.
2. Sin `Content-Length` (o si miente) → se cuentan los bytes a medida que
   llegan y se corta en cuanto se supera el límite: nunca se lee sin límite.
"""

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from .errors import FileTooLargeError, error_response


class BodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        declared = _content_length(scope)
        if declared is not None and declared > self.max_bytes:
            error = FileTooLargeError(self.max_bytes)
            response = error_response(error.status_code, error.code, error.detail)
            await response(scope, receive, send)
            return

        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    # Lo traduce a 413 el handler de errores (es un ApiError).
                    raise FileTooLargeError(self.max_bytes)
            return message

        await self.app(scope, limited_receive, send)


def _content_length(scope: Scope) -> int | None:
    for name, value in scope["headers"]:
        if name == b"content-length":
            try:
                return int(value)
            except ValueError:
                return None
    return None
