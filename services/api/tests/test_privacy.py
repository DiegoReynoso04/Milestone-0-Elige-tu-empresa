"""Privacidad: ningún dato de registros (emails, descripciones, IDs...) sale de la API."""

import unittest
from typing import Any, BinaryIO, NoReturn

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.errors import INTERNAL_ERROR_DETAIL
from app.modules.incidents.router import get_incident_service

from .support import EXPORT_URL, FIXTURE, HEADER, capture_logs, fixture_emails, make_client, post_csv

FORBIDDEN_KEYS = {"customer_email", "description", "ticket_id", "agent_id", "client_company", "rows", "records"}
# Otros valores de registros del fixture que tampoco deben salir.
FIXTURE_RECORD_VALUES = ("Acme Retail", "Printer not responding", "NXV-000001", "AGT-01", "BAD-13")
LEAK = "leak.canary@example.invalid"


def all_keys(value: Any) -> set[str]:
    if isinstance(value, dict):
        return set(value) | {key for item in value.values() for key in all_keys(item)}
    if isinstance(value, list):
        return {key for item in value for key in all_keys(item)}
    return set()


class ResponsePrivacyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = make_client()
        self.emails = fixture_emails()

    def assertNoRecordData(self, text: str) -> None:
        for email in self.emails:
            self.assertNotIn(email, text)
        self.assertNotIn("@", text)
        for value in FIXTURE_RECORD_VALUES:
            self.assertNotIn(value, text)

    def test_analysis_response(self) -> None:
        response = post_csv(self.client, FIXTURE.read_bytes())
        self.assertNoRecordData(response.text)
        self.assertEqual(all_keys(response.json()) & FORBIDDEN_KEYS, set())

    def test_export(self) -> None:
        post_csv(self.client, FIXTURE.read_bytes())
        self.assertNoRecordData(self.client.get(EXPORT_URL).text)

    def test_error_responses_and_logs(self) -> None:
        email_row = f"NXV-000001,2026-08-01,Acme Retail,TECHNICAL,Printer not responding,AGT-01,OPEN,{LEAK},\r\n"
        with capture_logs() as logs:
            responses = [
                post_csv(self.client, b"ticket_id,customer_email\r\nNXV-000001," + LEAK.encode() + b"\r\n"),  # 400
                post_csv(self.client, HEADER.encode() + email_row.encode("utf-8") + b"\xff\xfe"),  # 400 UTF-8
                post_csv(self.client, (HEADER + email_row).encode(), filename=f"{LEAK}.txt"),  # 415
                self.client.post("/api/incidents/analyze", data={"file": HEADER + email_row}),  # 422
                post_csv(make_client_with_limit(), (HEADER + email_row * 50).encode()),  # 413
            ]
        for response in responses:
            with self.subTest(status=response.status_code):
                self.assertGreaterEqual(response.status_code, 400)
                self.assertNotIn(LEAK, response.text)
                self.assertNotIn("Printer not responding", response.text)
        self.assertNotIn(LEAK, logs.text())


def make_client_with_limit() -> TestClient:
    return make_client(Settings(max_upload_bytes=1_000))


class ExplodingService:
    """Simula un fallo inesperado cuyo mensaje contiene datos del archivo."""

    def analyze_upload(self, filename: str | None, stream: BinaryIO) -> NoReturn:
        raise RuntimeError(f"unexpected failure while reading row with {LEAK}")

    def export_latest(self) -> NoReturn:
        raise KeyError(LEAK)


class UnexpectedErrorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = make_client()
        self.client.app.dependency_overrides[get_incident_service] = ExplodingService  # type: ignore[attr-defined]

    def assertOpaque500(self, response: Any, logs: Any) -> None:
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json(), {"detail": INTERNAL_ERROR_DETAIL, "code": "internal_error"})
        for leaked in (LEAK, "RuntimeError", "KeyError", "Traceback", "unexpected failure"):
            self.assertNotIn(leaked, response.text)
        log_text = logs.text()
        self.assertNotIn(LEAK, log_text)
        self.assertNotIn("unexpected failure", log_text)
        self.assertNotIn("Traceback", log_text)

    def test_exception_during_analysis(self) -> None:
        with capture_logs() as logs:
            response = post_csv(self.client, FIXTURE.read_bytes())
        self.assertOpaque500(response, logs)
        # Se registra algo para diagnóstico: solo el tipo, nunca el mensaje.
        self.assertIn("RuntimeError", logs.text())

    def test_exception_during_export(self) -> None:
        with capture_logs() as logs:
            response = self.client.get(EXPORT_URL)
        self.assertOpaque500(response, logs)


if __name__ == "__main__":
    unittest.main()
