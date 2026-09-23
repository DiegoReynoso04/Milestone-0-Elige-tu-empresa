"""Utilidades de test. Solo datos ficticios (`example.invalid`)."""

import contextlib
import csv
import logging
from collections.abc import Iterator
from pathlib import Path

from fastapi.testclient import TestClient
from httpx import Response

from app.core.config import Settings
from app.main import create_app

SERVICE_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = SERVICE_ROOT.parent.parent
# Se reutiliza el fixture sintético del núcleo (Fase 1): mismo archivo que usa la CLI.
FIXTURE = REPO_ROOT / "packages" / "incident-analyzer" / "tests" / "fixtures" / "incidents-synthetic.csv"
APP_DIR = SERVICE_ROOT / "app"
CORE_PACKAGE_DIR = REPO_ROOT / "packages" / "incident-analyzer" / "incident_analyzer"

ANALYZE_URL = "/api/incidents/analyze"
EXPORT_URL = "/api/incidents/results/export"
HEADER = "ticket_id,date,client_company,category,description,agent_id,status,customer_email,satisfaction_score\r\n"


def make_client(settings: Settings | None = None) -> TestClient:
    return TestClient(create_app(settings if settings is not None else Settings()))


def post_csv(client: TestClient, content: bytes, filename: str = "incidents.csv") -> Response:
    return client.post(ANALYZE_URL, files={"file": (filename, content, "text/csv")})


def csv_bytes(*lines: str) -> bytes:
    return (HEADER + "".join(line + "\r\n" for line in lines)).encode("utf-8")


BOUNDARY = "nexova-test-boundary"
MULTIPART_HEADERS = {"Content-Type": f"multipart/form-data; boundary={BOUNDARY}"}
VALID_ROW = "NXV-000001,2026-08-01,Acme,TECHNICAL,Printer broken,AGT-01,OPEN,a@example.invalid,\r\n"


def multipart_body(content: bytes, filename: str = "incidents.csv") -> bytes:
    return (
        f"--{BOUNDARY}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        "Content-Type: text/csv\r\n\r\n"
    ).encode() + content + f"\r\n--{BOUNDARY}--\r\n".encode()


def multipart_body_of_size(total_bytes: int) -> bytes:
    """Body multipart de exactamente `total_bytes` con un CSV válido de 1 registro.

    El relleno son líneas en blanco (`\\n`), que el lector del núcleo ignora:
    el análisis da siempre 1 registro válido, sea cual sea el tamaño.
    """
    base = (HEADER + VALID_ROW).encode()
    padding = total_bytes - len(multipart_body(base))
    if padding < 0:
        raise ValueError("total_bytes is smaller than the minimal body")
    body = multipart_body(base + b"\n" * padding)
    assert len(body) == total_bytes
    return body


def chunked(body: bytes, size: int = 64 * 1024) -> Iterator[bytes]:
    """Envía `body` sin Content-Length (httpx usa transfer-encoding chunked)."""
    for start in range(0, len(body), size):
        yield body[start : start + size]


def fixture_emails() -> list[str]:
    with FIXTURE.open(encoding="utf-8", newline="") as stream:
        return [row["customer_email"] for row in csv.DictReader(stream) if row["customer_email"]]


class _Collector(logging.Handler):
    def __init__(self) -> None:
        super().__init__(level=logging.DEBUG)
        self.records: list[logging.LogRecord] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.records.append(record)

    def text(self) -> str:
        parts = []
        for record in self.records:
            parts.append(record.getMessage())
            if record.exc_info:
                parts.append(logging.Formatter().formatException(record.exc_info))
        return "\n".join(parts)


@contextlib.contextmanager
def capture_logs() -> Iterator[_Collector]:
    """Captura todo lo que llegue al logger raíz (incluidos uvicorn/fastapi/starlette)."""
    root = logging.getLogger()
    collector = _Collector()
    previous_level = root.level
    root.addHandler(collector)
    root.setLevel(logging.DEBUG)
    try:
        yield collector
    finally:
        root.removeHandler(collector)
        root.setLevel(previous_level)
