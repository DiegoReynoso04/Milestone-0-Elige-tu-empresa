import unittest

from incident_analyzer import Rule, analyze_file, analyze_stream, render_report

from .support import FIXTURE, csv_lines, make_row


class ReportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.report = render_report(analyze_file(FIXTURE), "incidents-synthetic.csv")
        cls.lines = cls.report.splitlines()

    def line_with(self, text: str) -> str:
        matches = [line for line in self.lines if text in line]
        self.assertEqual(len(matches), 1, f"expected exactly one line containing {text!r}")
        return matches[0]

    def test_sections_in_context_order(self) -> None:
        headings = [
            "NEXOVA — SUPPORT TICKET ANALYSIS",
            "Source file: incidents-synthetic.csv",
            "TOTAL RECORDS IN FILE",
            "INVALID RECORDS BREAKDOWN",
            "BREAKDOWN BY CATEGORY (valid records)",
            "BREAKDOWN BY STATUS (valid records)",
            "SATISFACTION INDEX (closed tickets)",
        ]
        positions = [self.report.index(heading) for heading in headings]
        self.assertEqual(positions, sorted(positions))

    def test_totals(self) -> None:
        self.assertTrue(self.line_with("TOTAL RECORDS IN FILE").endswith(" 13"))
        self.assertTrue(self.line_with("Valid records").endswith(" 8"))
        self.assertTrue(self.line_with("Invalid / incomplete").endswith(" 5"))

    def test_all_seven_rules_are_shown_even_with_zero(self) -> None:
        for rule in Rule:
            with self.subTest(rule=rule):
                self.line_with(rule.label)
        zero_report = render_report(analyze_stream(csv_lines(make_row())), "x.csv")
        for rule in Rule:
            with self.subTest(rule=rule, report="all valid"):
                line = next(line for line in zero_report.splitlines() if rule.label in line)
                self.assertTrue(line.endswith(" 0"))

    def test_category_and_status_lines_show_count_and_percentage(self) -> None:
        self.assertTrue(self.line_with("TECHNICAL").endswith(" 2  (25.0%)"))
        self.assertTrue(self.line_with("ACCESS").endswith(" 1  (12.5%)"))
        self.assertTrue(self.line_with("CLOSED").endswith(" 4  (50.0%)"))

    def test_satisfaction_block(self) -> None:
        self.line_with("Scored tickets: 4 of 4")
        self.line_with("Average score: 3.75 / 5.00")
        self.assertTrue(self.line_with("Score 1 (Very dissatisfied)").endswith(" 0"))
        self.assertTrue(self.line_with("Score 4 (Satisfied)").endswith(" 2"))

    def test_last_branch_uses_closing_glyph(self) -> None:
        self.assertIn("└─ COMPLAINT", self.report)
        self.assertIn("├─ TECHNICAL", self.report)

    def test_ascii_mode_is_encodable_in_cp1252(self) -> None:
        report = render_report(analyze_file(FIXTURE), "incidents-synthetic.csv", ascii_only=True)
        report.encode("cp1252")
        self.assertIn("NEXOVA - SUPPORT TICKET ANALYSIS", report)
        self.assertIn("`- COMPLAINT", report)

    def test_empty_data_shows_not_available(self) -> None:
        report = render_report(analyze_stream(csv_lines()), "empty.csv")
        self.assertIn("Average score: n/a / 5.00", report)
        self.assertIn("(n/a)", report)


if __name__ == "__main__":
    unittest.main()
