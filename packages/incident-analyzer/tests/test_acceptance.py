"""Test de aceptación contra el dataset real `incidents-nexova.csv`.

PENDIENTE mientras el archivo no esté disponible: se marca como `skipped`,
nunca pasa con datos inventados. Para ejecutarlo, colocar el CSV en
`data/raw/incidents/incidents-nexova.csv` (ignorado por git: contiene emails
reales) o indicar otra ruta con la variable de entorno NEXOVA_INCIDENTS_CSV.

Valores esperados: docs/COMPANY_INCIDENT_FILE_ANALIZER_PROJECT.md,
secciones "Distribución de datos" y "Salida esperada".
"""

import os
import unittest
from decimal import Decimal
from pathlib import Path

from incident_analyzer import Category, Rule, Status, analyze_file, render_report, render_results_csv

from .support import REPO_ROOT

DATASET = Path(
    os.environ.get("NEXOVA_INCIDENTS_CSV", REPO_ROOT / "data" / "raw" / "incidents" / "incidents-nexova.csv")
)


@unittest.skipUnless(DATASET.is_file(), f"PENDING acceptance test: real dataset not available at {DATASET}")
class NexovaDatasetAcceptanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.result = analyze_file(DATASET)

    def test_totals(self) -> None:
        self.assertEqual(self.result.total_records, 100)
        self.assertEqual(self.result.valid_records, 96)
        self.assertEqual(self.result.invalid_records, 4)

    def test_categories(self) -> None:
        expected = {
            Category.TECHNICAL: (28, "29.2"),
            Category.BILLING: (18, "18.8"),
            Category.ACCESS: (21, "21.9"),
            Category.HR_QUERY: (17, "17.7"),
            Category.COMPLAINT: (12, "12.5"),
        }
        for category, (count, pct) in expected.items():
            with self.subTest(category=category):
                self.assertEqual(self.result.category(category).count, count)
                self.assertEqual(self.result.category(category).percentage, Decimal(pct))

    def test_statuses(self) -> None:
        expected = {Status.OPEN: (27, "28.1"), Status.CLOSED: (56, "58.3"), Status.DISCARDED: (13, "13.5")}
        for status, (count, pct) in expected.items():
            with self.subTest(status=status):
                self.assertEqual(self.result.status(status).count, count)
                self.assertEqual(self.result.status(status).percentage, Decimal(pct))

    def test_activated_rules(self) -> None:
        for rule in (
            Rule.MISSING_CLIENT_COMPANY,
            Rule.INVALID_CATEGORY,
            Rule.INVALID_EMAIL,
            Rule.CLOSED_WITHOUT_SCORE,
        ):
            with self.subTest(rule=rule):
                self.assertEqual(self.result.rule_count(rule), 1)

    def test_rules_not_listed_in_context_are_zero(self) -> None:
        # Deducido: la tabla "Regla activada" del documento solo lista las 4 anteriores.
        for rule in (Rule.INVALID_DESCRIPTION, Rule.INVALID_AGENT_ID, Rule.SCORE_OUT_OF_RANGE):
            with self.subTest(rule=rule):
                self.assertEqual(self.result.rule_count(rule), 0)

    def test_satisfaction(self) -> None:
        satisfaction = self.result.satisfaction
        self.assertEqual(satisfaction.closed_tickets, 56)
        self.assertEqual(satisfaction.scored_tickets, 56)
        self.assertEqual(
            {item.score: item.count for item in satisfaction.distribution},
            {1: 2, 2: 5, 3: 10, 4: 22, 5: 17},
        )
        self.assertEqual(satisfaction.average_score, Decimal("3.84"))

    def test_outputs_contain_no_email(self) -> None:
        self.assertNotIn("@", render_report(self.result, DATASET.name))
        self.assertNotIn("@", render_results_csv(self.result))


if __name__ == "__main__":
    unittest.main()
