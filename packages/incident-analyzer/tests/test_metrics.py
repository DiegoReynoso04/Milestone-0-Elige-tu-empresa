import unittest
from decimal import Decimal

from incident_analyzer import Category, Rule, Status, analyze_file, analyze_stream
from incident_analyzer.metrics import average, percentage

from .support import FIXTURE, csv_lines, make_row


class RoundingTests(unittest.TestCase):
    def test_percentage_rounds_half_up(self) -> None:
        # 1/16 = 6.25 %: round() "al par" daría 6.2.
        self.assertEqual(percentage(1, 16), Decimal("6.3"))

    def test_percentage_common_values(self) -> None:
        self.assertEqual(percentage(1, 3), Decimal("33.3"))
        self.assertEqual(percentage(2, 3), Decimal("66.7"))
        self.assertEqual(percentage(28, 96), Decimal("29.2"))
        self.assertEqual(percentage(18, 96), Decimal("18.8"))
        self.assertEqual(percentage(12, 96), Decimal("12.5"))

    def test_percentage_without_valid_records_is_none(self) -> None:
        self.assertIsNone(percentage(0, 0))

    def test_average_rounds_half_up(self) -> None:
        # 17/8 = 2.125: round() "al par" daría 2.12.
        self.assertEqual(average(17, 8), Decimal("2.13"))

    def test_average_of_context_distribution_is_3_84(self) -> None:
        # Distribución del documento: 2×1 + 5×2 + 10×3 + 22×4 + 17×5 = 215 sobre 56.
        self.assertEqual(average(215, 56), Decimal("3.84"))

    def test_average_without_scores_is_none(self) -> None:
        self.assertIsNone(average(0, 0))


class FixtureMetricsTests(unittest.TestCase):
    """Valores esperados calculados a mano sobre tests/fixtures/incidents-synthetic.csv."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.result = analyze_file(FIXTURE)

    def test_totals(self) -> None:
        self.assertEqual(self.result.total_records, 13)
        self.assertEqual(self.result.valid_records, 8)
        self.assertEqual(self.result.invalid_records, 5)

    def test_rule_breakdown_counts_every_activation(self) -> None:
        expected = {
            Rule.MISSING_CLIENT_COMPANY: 2,
            Rule.INVALID_CATEGORY: 1,
            Rule.INVALID_DESCRIPTION: 1,
            Rule.INVALID_AGENT_ID: 1,
            Rule.INVALID_EMAIL: 2,
            Rule.CLOSED_WITHOUT_SCORE: 1,
            Rule.SCORE_OUT_OF_RANGE: 1,
        }
        for rule, count in expected.items():
            with self.subTest(rule=rule):
                self.assertEqual(self.result.rule_count(rule), count)
        # D1: 9 activaciones repartidas en 5 filas inválidas.
        self.assertEqual(sum(item.count for item in self.result.invalid_breakdown), 9)

    def test_breakdown_lists_all_seven_rules_in_context_order(self) -> None:
        self.assertEqual([item.rule for item in self.result.invalid_breakdown], list(Rule))

    def test_categories_over_valid_records(self) -> None:
        expected = {
            Category.TECHNICAL: (2, "25.0"),
            Category.BILLING: (2, "25.0"),
            Category.ACCESS: (1, "12.5"),
            Category.HR_QUERY: (1, "12.5"),
            Category.COMPLAINT: (2, "25.0"),
        }
        for category, (count, pct) in expected.items():
            with self.subTest(category=category):
                item = self.result.category(category)
                self.assertEqual(item.count, count)
                self.assertEqual(item.percentage, Decimal(pct))

    def test_statuses_over_valid_records(self) -> None:
        expected = {Status.OPEN: (2, "25.0"), Status.CLOSED: (4, "50.0"), Status.DISCARDED: (1, "12.5")}
        for status, (count, pct) in expected.items():
            with self.subTest(status=status):
                item = self.result.status(status)
                self.assertEqual(item.count, count)
                self.assertEqual(item.percentage, Decimal(pct))

    def test_unknown_status_is_valid_but_not_in_status_breakdown(self) -> None:
        # D3: la fila con status PENDING es válida (cuenta en categorías) pero
        # no aparece en el desglose por estado.
        self.assertEqual(sum(item.count for item in self.result.statuses), self.result.valid_records - 1)
        self.assertEqual(sum(item.count for item in self.result.categories), self.result.valid_records)

    def test_satisfaction_only_uses_valid_closed_tickets(self) -> None:
        satisfaction = self.result.satisfaction
        self.assertEqual(satisfaction.closed_tickets, 4)
        self.assertEqual(satisfaction.scored_tickets, 4)
        # CLOSED válidos: 5, 4, 2, 4 → 15/4. El 3 del ticket OPEN no participa.
        self.assertEqual(satisfaction.average_score, Decimal("3.75"))
        counts = {item.score: item.count for item in satisfaction.distribution}
        self.assertEqual(counts, {1: 0, 2: 1, 3: 0, 4: 2, 5: 1})


class MultipleRuleCountingTests(unittest.TestCase):
    def test_multi_rule_row_counts_once_as_invalid_and_once_per_rule(self) -> None:
        bad = make_row(row_number=3, client_company="", customer_email="", agent_id="X")
        result = analyze_stream(csv_lines(make_row(row_number=2), bad))
        self.assertEqual(result.total_records, 2)
        self.assertEqual(result.invalid_records, 1)
        self.assertEqual(result.rule_count(Rule.MISSING_CLIENT_COMPANY), 1)
        self.assertEqual(result.rule_count(Rule.INVALID_EMAIL), 1)
        self.assertEqual(result.rule_count(Rule.INVALID_AGENT_ID), 1)
        self.assertEqual(result.rule_count(Rule.INVALID_CATEGORY), 0)


class EmptyDataTests(unittest.TestCase):
    def test_header_only_file(self) -> None:
        result = analyze_stream(csv_lines())
        self.assertEqual(result.total_records, 0)
        self.assertIsNone(result.category(Category.TECHNICAL).percentage)
        self.assertIsNone(result.satisfaction.average_score)


if __name__ == "__main__":
    unittest.main()
