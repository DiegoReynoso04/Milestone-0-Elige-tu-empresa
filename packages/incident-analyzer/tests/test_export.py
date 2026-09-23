import csv
import io
import tempfile
import unittest
from pathlib import Path

from incident_analyzer import analyze_file, analyze_stream, build_export_metrics, render_results_csv, write_results_csv
from incident_analyzer.export import neutralize_formula

from .support import FIXTURE, csv_lines


def parse(text: str) -> list[list[str]]:
    return list(csv.reader(io.StringIO(text, newline="")))


class ExportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.result = analyze_file(FIXTURE)
        cls.rows = parse(render_results_csv(cls.result))

    def test_header_is_metric_value(self) -> None:
        self.assertEqual(self.rows[0], ["metric", "value"])

    def test_one_metric_per_row_with_two_columns(self) -> None:
        self.assertTrue(all(len(row) == 2 for row in self.rows))
        names = [row[0] for row in self.rows[1:]]
        self.assertEqual(len(names), len(set(names)), "metric names must be unique")

    def test_expected_metric_values(self) -> None:
        values = dict(self.rows[1:])
        expected = {
            "total_records": "13",
            "valid_records": "8",
            "invalid_records": "5",
            "rule_missing_client_company": "2",
            "rule_invalid_category": "1",
            "rule_invalid_description": "1",
            "rule_invalid_agent_id": "1",
            "rule_invalid_email": "2",
            "rule_closed_without_score": "1",
            "rule_score_out_of_range": "1",
            "category_technical_count": "2",
            "category_technical_pct": "25.0",
            "category_access_pct": "12.5",
            "status_closed_count": "4",
            "status_closed_pct": "50.0",
            "satisfaction_closed_tickets": "4",
            "satisfaction_scored_tickets": "4",
            "satisfaction_average_score": "3.75",
            "satisfaction_score_4_count": "2",
            "satisfaction_score_3_count": "0",
        }
        for name, value in expected.items():
            with self.subTest(metric=name):
                self.assertEqual(values[name], value)

    def test_metric_count_is_stable(self) -> None:
        # 3 totales + 7 reglas + 5 categorías×2 + 3 estados×2 + 3 satisfacción + 5 puntuaciones
        self.assertEqual(len(build_export_metrics(self.result)), 34)

    def test_write_results_csv_matches_render(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "results.csv"
            write_results_csv(self.result, path)
            # Bytes, no read_text(): este normalizaría los \r\n que escribe csv.writer.
            self.assertEqual(path.read_bytes().decode("utf-8"), render_results_csv(self.result))

    def test_export_contains_no_at_sign(self) -> None:
        self.assertNotIn("@", render_results_csv(self.result))

    def test_empty_data_exports_not_available(self) -> None:
        values = dict(parse(render_results_csv(analyze_stream(csv_lines())))[1:])
        self.assertEqual(values["satisfaction_average_score"], "N/A")
        self.assertEqual(values["category_technical_pct"], "N/A")


class FormulaInjectionTests(unittest.TestCase):
    def test_dangerous_prefixes_are_neutralized(self) -> None:
        for cell in ("=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx"):
            with self.subTest(cell=cell):
                self.assertEqual(neutralize_formula(cell), "'" + cell)

    def test_safe_values_are_untouched(self) -> None:
        for cell in ("12", "3.84", "N/A", "total_records"):
            with self.subTest(cell=cell):
                self.assertEqual(neutralize_formula(cell), cell)


if __name__ == "__main__":
    unittest.main()
