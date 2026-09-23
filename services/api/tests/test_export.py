"""GET /api/incidents/results/export — último análisis, formato y cabeceras."""

import csv
import io
import unittest
from typing import BinaryIO, NoReturn

from fastapi import Request
from incident_analyzer import analyze_file, render_results_csv

from app.core.config import DEFAULT_MAX_UPLOAD_BYTES
from app.modules.incidents.router import get_incident_service
from app.modules.incidents.service import IncidentService

from .support import (
    ANALYZE_URL,
    EXPORT_URL,
    FIXTURE,
    MULTIPART_HEADERS,
    capture_logs,
    chunked,
    csv_bytes,
    make_client,
    multipart_body_of_size,
    post_csv,
)

LEAK = "b.failure.canary@example.invalid"


class ExportTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = make_client()

    def test_without_analysis_returns_404(self) -> None:
        response = self.client.get(EXPORT_URL)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"detail": "no analysis available yet", "code": "no_analysis"})

    def test_after_analysis_returns_csv_with_headers(self) -> None:
        analysis_id = post_csv(self.client, FIXTURE.read_bytes()).json()["analysis_id"]
        response = self.client.get(EXPORT_URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "text/csv; charset=utf-8")
        self.assertEqual(response.headers["content-disposition"], 'attachment; filename="results.csv"')
        self.assertEqual(response.headers["x-analysis-id"], analysis_id)

    def test_body_is_metric_value_one_metric_per_row(self) -> None:
        post_csv(self.client, FIXTURE.read_bytes())
        rows = list(csv.reader(io.StringIO(self.client.get(EXPORT_URL).text, newline="")))
        self.assertEqual(rows[0], ["metric", "value"])
        self.assertTrue(all(len(row) == 2 for row in rows))
        self.assertEqual(dict(rows[1:])["total_records"], "13")

    def test_body_is_exactly_render_results_csv_like_the_cli(self) -> None:
        # La CLI escribe results.csv con render_results_csv(analyze_file(...)).
        post_csv(self.client, FIXTURE.read_bytes())
        self.assertEqual(self.client.get(EXPORT_URL).content, render_results_csv(analyze_file(FIXTURE)).encode("utf-8"))

    def test_later_analysis_replaces_previous(self) -> None:
        post_csv(self.client, FIXTURE.read_bytes())
        second = post_csv(
            self.client, csv_bytes("NXV-000001,2026-08-01,Acme,TECHNICAL,Printer broken,AGT-01,OPEN,a@example.invalid,")
        ).json()
        response = self.client.get(EXPORT_URL)
        self.assertEqual(response.headers["x-analysis-id"], second["analysis_id"])
        self.assertEqual(dict(csv.reader(io.StringIO(response.text, newline="")))["total_records"], "1")

    def test_failed_analysis_keeps_previous_result(self) -> None:
        first = post_csv(self.client, FIXTURE.read_bytes()).json()
        for bad in (
            post_csv(self.client, b""),  # 400
            post_csv(self.client, FIXTURE.read_bytes(), filename="incidents.txt"),  # 415
            self.client.post("/api/incidents/analyze", data={"other": "x"}),  # 422
        ):
            self.assertGreaterEqual(bad.status_code, 400)
        response = self.client.get(EXPORT_URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["x-analysis-id"], first["analysis_id"])

    def test_each_app_has_its_own_store(self) -> None:
        post_csv(self.client, FIXTURE.read_bytes())
        self.assertEqual(make_client().get(EXPORT_URL).status_code, 404)


class FailingAnalyzeService(IncidentService):
    """Servicio real salvo el análisis, que falla de forma inesperada con datos en el mensaje."""

    def analyze_upload(self, filename: str | None, stream: BinaryIO) -> NoReturn:
        raise RuntimeError(f"unexpected failure with {LEAK}")


def failing_analyze_service(request: Request) -> IncidentService:
    return FailingAnalyzeService(request.app.state.result_store)


class LastSuccessfulAnalysisTests(unittest.TestCase):
    """Un fallo de B después del éxito de A deja exportable exactamente A."""

    def setUp(self) -> None:
        self.client = make_client()
        self.analysis_a = post_csv(self.client, FIXTURE.read_bytes()).json()["analysis_id"]
        export_a = self.client.get(EXPORT_URL)
        self.assertEqual(export_a.headers["x-analysis-id"], self.analysis_a)
        self.export_a = export_a.content

    def assertExportIsStillA(self) -> None:
        response = self.client.get(EXPORT_URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["x-analysis-id"], self.analysis_a)
        self.assertEqual(response.content, self.export_a)

    def test_b_rejected_with_413_keeps_a(self) -> None:
        body = multipart_body_of_size(DEFAULT_MAX_UPLOAD_BYTES + 1)
        for stream in (False, True):
            with self.subTest(content_length=not stream):
                response = self.client.post(
                    ANALYZE_URL, content=chunked(body) if stream else body, headers=MULTIPART_HEADERS
                )
                self.assertEqual(response.status_code, 413)
                self.assertEqual(response.json()["code"], "file_too_large")
                self.assertExportIsStillA()

    def test_b_failing_with_500_keeps_a_and_leaks_nothing(self) -> None:
        self.client.app.dependency_overrides[get_incident_service] = failing_analyze_service  # type: ignore[attr-defined]
        with capture_logs() as logs:
            response = post_csv(self.client, FIXTURE.read_bytes())
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json(), {"detail": "internal server error", "code": "internal_error"})
        for leaked in (LEAK, "unexpected failure", "RuntimeError"):
            self.assertNotIn(leaked, response.text)
        self.assertNotIn(LEAK, logs.text())
        self.assertNotIn("unexpected failure", logs.text())
        # El export usa el mismo servicio sobrescrito, cuyo export_latest es el real.
        self.assertExportIsStillA()


class CacheControlTests(unittest.TestCase):
    def test_analyze_response_is_no_store(self) -> None:
        response = post_csv(make_client(), FIXTURE.read_bytes())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_export_response_is_no_store(self) -> None:
        client = make_client()
        post_csv(client, FIXTURE.read_bytes())
        response = client.get(EXPORT_URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["cache-control"], "no-store")


if __name__ == "__main__":
    unittest.main()
