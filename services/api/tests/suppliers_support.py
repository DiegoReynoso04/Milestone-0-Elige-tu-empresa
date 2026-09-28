"""Utilidades de los tests del directorio de proveedores.

Cada test usa su propia base TinyDB en un directorio temporal: nunca toca
services/api/data/.
"""

import copy
import re
import tempfile
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.database import SupplierRepository
from app.main import create_app
from app.seed import run_seed

from .support import REPO_ROOT

CONTEXT_DOC = REPO_ROOT / "docs" / "ligthweight-storage-api.md"
SUPPLIERS_URL = "/suppliers"

VALID_SUPPLIER: dict[str, Any] = {
    "name": "Synthetic Supplier",
    "country": "Spain",
    "categories": ["job_boards"],
    "monthly_rate": 100.0,
    "currency": "EUR",
    "status": "active",
}


def context_definitions() -> dict[str, Any]:
    """Ejecuta los bloques ```python del CONTEXT y devuelve lo que definen."""
    namespace: dict[str, Any] = {}
    for block in re.findall(r"```python\n(.*?)```", CONTEXT_DOC.read_text(encoding="utf-8"), re.S):
        exec(block, namespace)  # noqa: S102 — documento del propio repo
    return namespace


def valid_supplier(**changes: Any) -> dict[str, Any]:
    supplier = copy.deepcopy(VALID_SUPPLIER)
    supplier.update(changes)
    return supplier


class FakeClock:
    def __init__(self, start: datetime = datetime(2026, 9, 1, 8, 0, tzinfo=UTC)) -> None:
        self.now = start

    def __call__(self) -> datetime:
        return self.now

    def advance(self, **delta: float) -> datetime:
        self.now += timedelta(**delta)
        return self.now


class SupplierTestCase(unittest.TestCase):
    """Cliente con una base TinyDB temporal y reloj controlado."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.db_path = Path(self._tmp.name) / "data" / "suppliers.json"
        self.clock = FakeClock()
        self.client = self.make_client()

    def make_client(self) -> TestClient:
        app = create_app(Settings(suppliers_db_path=self.db_path))
        app.state.supplier_repository = SupplierRepository(self.db_path, clock=self.clock)
        return TestClient(app)

    def seed(self) -> None:
        run_seed(SupplierRepository(self.db_path, clock=self.clock))

    def create(self, **changes: Any) -> dict[str, Any]:
        response = self.client.post(SUPPLIERS_URL, json=valid_supplier(**changes))
        self.assertEqual(response.status_code, 201, response.text)
        body: dict[str, Any] = response.json()
        return body

    def count(self) -> int:
        return len(self.client.get(SUPPLIERS_URL).json())
