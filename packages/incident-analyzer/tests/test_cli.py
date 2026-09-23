"""Tests de extremo a extremo de `scripts/analyze.py`, ejecutado como subproceso."""

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from .support import CLI, FIXTURE, fixture_emails

PROMPT = "Export results to CSV? [y / n]:"


def run_cli(*args: str, cwd: Path, stdin: str = "", encoding: str = "utf-8") -> subprocess.CompletedProcess[str]:
    env = {**os.environ, "PYTHONIOENCODING": encoding}
    # Sin PYTHONPATH: el CLI debe encontrar el paquete por sí mismo.
    env.pop("PYTHONPATH", None)
    return subprocess.run(
        [sys.executable, str(CLI), *args],
        cwd=cwd,
        input=stdin,
        capture_output=True,
        text=True,
        encoding=encoding,
        env=env,
        timeout=60,
    )


@unittest.skipUnless(CLI.exists(), f"CLI not found at {CLI}")
class CliTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.cwd = Path(self._tmp.name)
        self.results = self.cwd / "results.csv"

    def assertNoEmails(self, process: subprocess.CompletedProcess[str]) -> None:
        for email in fixture_emails():
            self.assertNotIn(email, process.stdout)
            self.assertNotIn(email, process.stderr)
        self.assertNotIn("@", process.stdout + process.stderr)

    def test_interactive_default_asks_and_exports_on_y(self) -> None:
        process = run_cli(str(FIXTURE), cwd=self.cwd, stdin="y\n")
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertIn("NEXOVA — SUPPORT TICKET ANALYSIS", process.stdout)
        self.assertIn(PROMPT, process.stdout)
        self.assertTrue(self.results.exists())
        self.assertNotIn("@", self.results.read_text(encoding="utf-8"))
        self.assertNoEmails(process)

    def test_interactive_n_does_not_export(self) -> None:
        process = run_cli(str(FIXTURE), cwd=self.cwd, stdin="n\n")
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertIn(PROMPT, process.stdout)
        self.assertFalse(self.results.exists())

    def test_interactive_reasks_until_valid_answer(self) -> None:
        process = run_cli(str(FIXTURE), cwd=self.cwd, stdin="maybe\nY\n")
        self.assertEqual(process.stdout.count(PROMPT), 2)
        self.assertTrue(self.results.exists())

    def test_interactive_eof_does_not_export(self) -> None:
        process = run_cli(str(FIXTURE), cwd=self.cwd, stdin="")
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertFalse(self.results.exists())

    def test_non_interactive_export(self) -> None:
        output = self.cwd / "out" / "metrics.csv"
        output.parent.mkdir()
        process = run_cli(str(FIXTURE), "--export", "--output", str(output), cwd=self.cwd)
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertNotIn(PROMPT, process.stdout)
        self.assertTrue(output.read_text(encoding="utf-8").startswith("metric,value"))
        self.assertNoEmails(process)

    def test_non_interactive_no_export(self) -> None:
        process = run_cli(str(FIXTURE), "--no-export", cwd=self.cwd)
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertNotIn(PROMPT, process.stdout)
        self.assertFalse(self.results.exists())

    def test_accepts_any_path_and_shows_only_the_file_name(self) -> None:
        copy = self.cwd / "nested dir" / "any-name.csv"
        copy.parent.mkdir()
        copy.write_bytes(FIXTURE.read_bytes())
        process = run_cli(str(copy), "--no-export", cwd=self.cwd)
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertIn("Source file: any-name.csv", process.stdout)
        self.assertNotIn("nested dir", process.stdout)

    def test_cp1252_console_falls_back_to_ascii(self) -> None:
        process = run_cli(str(FIXTURE), "--no-export", cwd=self.cwd, encoding="cp1252")
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertIn("NEXOVA - SUPPORT TICKET ANALYSIS", process.stdout)

    def test_missing_file_exits_with_error(self) -> None:
        process = run_cli(str(self.cwd / "missing.csv"), "--no-export", cwd=self.cwd)
        self.assertEqual(process.returncode, 1)
        self.assertIn("error:", process.stderr)

    def test_invalid_file_exits_with_safe_error(self) -> None:
        bad = self.cwd / "bad.csv"
        bad.write_text("ticket_id,customer_email\nNXV-1,leak@example.invalid\n", encoding="utf-8")
        process = run_cli(str(bad), "--no-export", cwd=self.cwd)
        self.assertEqual(process.returncode, 1)
        self.assertIn("missing required columns", process.stderr)
        self.assertNotIn("leak", process.stdout + process.stderr)

    def test_export_flags_are_mutually_exclusive(self) -> None:
        process = run_cli(str(FIXTURE), "--export", "--no-export", cwd=self.cwd)
        self.assertEqual(process.returncode, 2)


if __name__ == "__main__":
    unittest.main()
