"""Garantías de privacidad: `customer_email` no sale por ninguna vía.

Todos los emails del fixture son ficticios (`example.invalid`), incluido uno
sin `@` que debe tratarse igual de sensible.
"""

import ast
import contextlib
import dataclasses
import io
import unittest
from enum import Enum
from pathlib import Path

import incident_analyzer
from incident_analyzer import (
    IncidentFileError,
    analyze_file,
    analyze_stream,
    render_report,
    render_results_csv,
    validate_row,
)
from incident_analyzer.reader import read_rows

from .support import FIXTURE, fixture_emails, make_row

PACKAGE_DIR = Path(incident_analyzer.__file__).resolve().parent


def collect_strings(value: object) -> list[str]:
    """Todas las cadenas alcanzables dentro de un resultado (dataclasses, tuplas, enums)."""
    if isinstance(value, str):
        return [value]
    if isinstance(value, Enum):
        return collect_strings(value.value)
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return [s for field in dataclasses.fields(value) for s in collect_strings(getattr(value, field.name))]
    if isinstance(value, (tuple, list, frozenset, set)):
        return [s for item in value for s in collect_strings(item)]
    return []


class FixtureSanityTests(unittest.TestCase):
    def test_fixture_only_uses_fictitious_domain(self) -> None:
        emails = fixture_emails()
        self.assertGreater(len(emails), 5)
        for email in emails:
            self.assertTrue(email.endswith("example.invalid"), "fixtures must use example.invalid only")


class OutputPrivacyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.emails = fixture_emails()
        cls.result = analyze_file(FIXTURE)

    def assertNoEmails(self, text: str) -> None:
        for email in self.emails:
            self.assertNotIn(email, text)
        self.assertNotIn("@", text)

    def test_console_report_contains_no_email(self) -> None:
        self.assertNoEmails(render_report(self.result, FIXTURE.name))
        self.assertNoEmails(render_report(self.result, FIXTURE.name, ascii_only=True))

    def test_results_csv_contains_no_email(self) -> None:
        self.assertNoEmails(render_results_csv(self.result))

    def test_analysis_result_holds_no_record_text(self) -> None:
        # El resultado solo contiene enums y etiquetas fijas: ni emails ni
        # descripciones, empresas o ticket IDs del archivo.
        strings = collect_strings(self.result)
        for text in strings:
            self.assertNoEmails(text)
        for record_text in ("Acme Retail", "Printer not responding", "NXV-000001", "AGT-01"):
            self.assertNotIn(record_text, strings)

    def test_analysis_prints_nothing_and_logs_nothing(self) -> None:
        stdout, stderr = io.StringIO(), io.StringIO()
        with (
            contextlib.redirect_stdout(stdout),
            contextlib.redirect_stderr(stderr),
            self.assertNoLogs(level="DEBUG"),
        ):
            result = analyze_file(FIXTURE)
            render_report(result, FIXTURE.name)
            render_results_csv(result)
        self.assertEqual(stdout.getvalue(), "")
        self.assertEqual(stderr.getvalue(), "")


class ValidationPrivacyTests(unittest.TestCase):
    def test_validation_results_never_include_the_email(self) -> None:
        with FIXTURE.open(encoding="utf-8", newline="") as stream:
            rows = list(read_rows(stream))
        for row in rows:
            result = validate_row(row)
            with self.subTest(row=row.row_number):
                self.assertEqual({field.name for field in dataclasses.fields(result)}, {"row_number", "violations"})
                for text in (repr(result), str(result), *collect_strings(result)):
                    if row.customer_email:
                        self.assertNotIn(row.customer_email, text)
                    self.assertNotIn("@", text)

    def test_invalid_email_is_reported_only_as_a_rule(self) -> None:
        result = validate_row(make_row(customer_email="leak.example.invalid"))
        self.assertEqual({rule.code for rule in result.violations}, {"invalid_email"})
        self.assertNotIn("leak", repr(result))

    def test_printing_a_row_does_not_expose_its_values(self) -> None:
        row = make_row(customer_email="hidden@example.invalid", client_company="Hidden Corp")
        for text in (repr(row), str(row), f"{row}", repr([row])):
            self.assertNotIn("hidden@example.invalid", text)
            self.assertNotIn("Hidden Corp", text)

    def test_file_errors_do_not_echo_content(self) -> None:
        lines = ["ticket_id,customer_email\n", "NXV-1,leak@example.invalid\n"]
        with self.assertRaises(IncidentFileError) as caught:
            analyze_stream(lines)
        self.assertNotIn("leak", str(caught.exception))


class SourceCodeGuardTests(unittest.TestCase):
    """El núcleo no imprime ni registra nada: la salida la decide quien llama."""

    def test_core_modules_do_not_print_or_log(self) -> None:
        for module in sorted(PACKAGE_DIR.glob("*.py")):
            tree = ast.parse(module.read_text(encoding="utf-8"))
            with self.subTest(module=module.name):
                for node in ast.walk(tree):
                    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                        self.assertNotEqual(node.func.id, "print", f"print() in {module.name}")
                    if isinstance(node, (ast.Import, ast.ImportFrom)):
                        names = [alias.name for alias in node.names]
                        module_name = getattr(node, "module", None) or ""
                        self.assertNotIn("logging", [*names, module_name], f"logging in {module.name}")


if __name__ == "__main__":
    unittest.main()
