"""Aceptación con un fixture SINTÉTICO que reproduce las cifras del contexto.

`tests/fixtures/incidents-acceptance-synthetic.csv` NO es el archivo original
de Nexova ni contiene datos reales: es un CSV generado para que el analizador
produzca exactamente los valores de docs/COMPANY_INCIDENT_FILE_ANALIZER_PROJECT.md
("Distribución de datos" y "Salida esperada"). Emails ficticios `example.invalid`.

El test contra el CSV real (`test_acceptance.py`) sigue siendo el que valida los
datos de Nexova y permanece omitido mientras ese archivo no esté disponible.

Privacidad: ninguna aserción incluye emails en su mensaje, ni siquiera si falla.
"""

import re
import unittest
from decimal import Decimal

from incident_analyzer import (
    Category,
    IncidentRow,
    Rule,
    Status,
    analyze_file,
    render_report,
    render_results_csv,
    validate_row,
)
from incident_analyzer.reader import read_rows

from .support import FIXTURE, PACKAGE_ROOT

SYNTHETIC = PACKAGE_ROOT / "tests" / "fixtures" / "incidents-acceptance-synthetic.csv"

# Filas del CSV (la cabecera es la fila 1) que deben ser inválidas y la única regla de cada una.
EXPECTED_INVALID_ROWS = {
    18: {Rule.MISSING_CLIENT_COMPANY},
    45: {Rule.INVALID_CATEGORY},
    71: {Rule.INVALID_EMAIL},
    93: {Rule.CLOSED_WITHOUT_SCORE},
}


def read_fixture_rows() -> list[IncidentRow]:
    with SYNTHETIC.open(encoding="utf-8", newline="") as stream:
        return list(read_rows(stream))


class SyntheticAcceptanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.result = analyze_file(SYNTHETIC)
        cls.rows = read_fixture_rows()

    def test_totals(self) -> None:
        self.assertEqual(self.result.total_records, 100)
        self.assertEqual(self.result.valid_records, 96)
        self.assertEqual(self.result.invalid_records, 4)

    def test_rule_breakdown(self) -> None:
        expected = {
            Rule.MISSING_CLIENT_COMPANY: 1,
            Rule.INVALID_CATEGORY: 1,
            Rule.INVALID_DESCRIPTION: 0,
            Rule.INVALID_AGENT_ID: 0,
            Rule.INVALID_EMAIL: 1,
            Rule.CLOSED_WITHOUT_SCORE: 1,
            Rule.SCORE_OUT_OF_RANGE: 0,
        }
        for rule, count in expected.items():
            with self.subTest(rule=rule.code):
                self.assertEqual(self.result.rule_count(rule), count)

    def test_each_invalid_row_activates_only_its_rule(self) -> None:
        activated = {row.row_number: set(validate_row(row).violations) for row in self.rows}
        invalid = {number: rules for number, rules in activated.items() if rules}
        self.assertEqual(invalid, EXPECTED_INVALID_ROWS)

    def test_categories(self) -> None:
        expected = {
            Category.TECHNICAL: (28, "29.2"),
            Category.BILLING: (18, "18.8"),
            Category.ACCESS: (21, "21.9"),
            Category.HR_QUERY: (17, "17.7"),
            Category.COMPLAINT: (12, "12.5"),
        }
        for category, (count, pct) in expected.items():
            with self.subTest(category=category.value):
                self.assertEqual(self.result.category(category).count, count)
                self.assertEqual(self.result.category(category).percentage, Decimal(pct))

    def test_statuses(self) -> None:
        expected = {Status.OPEN: (27, "28.1"), Status.CLOSED: (56, "58.3"), Status.DISCARDED: (13, "13.5")}
        for status, (count, pct) in expected.items():
            with self.subTest(status=status.value):
                self.assertEqual(self.result.status(status).count, count)
                self.assertEqual(self.result.status(status).percentage, Decimal(pct))

    def test_satisfaction(self) -> None:
        satisfaction = self.result.satisfaction
        self.assertEqual(satisfaction.closed_tickets, 56)
        self.assertEqual(satisfaction.scored_tickets, 56)
        self.assertEqual(
            {item.score: item.count for item in satisfaction.distribution},
            {1: 2, 2: 5, 3: 10, 4: 22, 5: 17},
        )
        # 2×1 + 5×2 + 10×3 + 22×4 + 17×5 = 215; 215 / 56 = 3.8393 → 3.84 (ROUND_HALF_UP).
        self.assertEqual(satisfaction.average_score, Decimal("3.84"))


class SyntheticFixtureShapeTests(unittest.TestCase):
    """El fixture respeta el formato del contexto (sin revalidar reglas de negocio)."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.rows = read_fixture_rows()

    def test_one_hundred_data_rows_with_unique_ids(self) -> None:
        self.assertEqual(len(self.rows), 100)
        self.assertEqual(len({row.ticket_id for row in self.rows}), 100)
        self.assertTrue(all(re.fullmatch(r"NXV-\d{6}", row.ticket_id) for row in self.rows))
        self.assertTrue(all(re.fullmatch(r"\d{4}-\d{2}-\d{2}", row.date) for row in self.rows))

    def test_only_fictitious_example_invalid_emails(self) -> None:
        self.assertTrue(
            all(row.customer_email.endswith("example.invalid") for row in self.rows),
            "fixture must only use example.invalid emails",
        )

    def test_rows_are_marked_as_synthetic(self) -> None:
        self.assertTrue(all(row.description.startswith("Synthetic ticket ") for row in self.rows))
        companies = [row.client_company for row in self.rows if row.client_company]
        self.assertTrue(all(company.startswith("Synthetic Client ") for company in companies))

    def test_existing_small_fixture_is_kept(self) -> None:
        self.assertTrue(FIXTURE.is_file())
        self.assertNotEqual(FIXTURE, SYNTHETIC)


class SyntheticOutputPrivacyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        result = analyze_file(SYNTHETIC)
        cls.outputs = {
            "console report": render_report(result, SYNTHETIC.name),
            "console report (ascii)": render_report(result, SYNTHETIC.name, ascii_only=True),
            "results.csv": render_results_csv(result),
        }
        cls.emails = [row.customer_email for row in read_fixture_rows() if row.customer_email]

    def test_outputs_contain_no_email(self) -> None:
        for name, text in self.outputs.items():
            with self.subTest(output=name):
                # assertFalse con mensaje fijo: si fallase, no imprime el email.
                self.assertFalse("@" in text, f"{name} contains '@'")
                self.assertFalse(any(email in text for email in self.emails), f"{name} contains a fixture email")

    def test_validation_results_contain_no_email(self) -> None:
        for row in read_fixture_rows():
            text = repr(validate_row(row)) + repr(row)
            self.assertFalse(row.customer_email and row.customer_email in text, f"row {row.row_number} exposes its email")


if __name__ == "__main__":
    unittest.main()
