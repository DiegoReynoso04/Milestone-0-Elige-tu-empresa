import tempfile
import unittest
from pathlib import Path

from incident_analyzer import IncidentFileError, Rule, analyze_file, analyze_stream
from incident_analyzer.reader import read_rows

HEADER = "ticket_id,date,client_company,category,description,agent_id,status,customer_email,satisfaction_score\n"
VALID_LINE = "NXV-000001,2026-08-01,Acme,TECHNICAL,Printer broken,AGT-01,OPEN,a@example.invalid,\n"


class ReadRowsTests(unittest.TestCase):
    def test_row_numbers_start_at_two_after_header(self) -> None:
        rows = list(read_rows([HEADER, VALID_LINE, VALID_LINE]))
        self.assertEqual([row.row_number for row in rows], [2, 3])

    def test_values_are_stripped(self) -> None:
        line = "NXV-000001, 2026-08-01 ,  Acme , TECHNICAL , Printer broken , AGT-01 , CLOSED , a@example.invalid , 4 \n"
        result = analyze_stream([HEADER, line])
        self.assertEqual(result.valid_records, 1)
        self.assertEqual(result.satisfaction.scored_tickets, 1)

    def test_whitespace_only_field_counts_as_empty(self) -> None:
        line = "NXV-000001,2026-08-01,   ,TECHNICAL,Printer broken,AGT-01,OPEN,a@example.invalid,\n"
        result = analyze_stream([HEADER, line])
        self.assertEqual(result.rule_count(Rule.MISSING_CLIENT_COMPANY), 1)

    def test_header_names_are_stripped_and_column_order_is_free(self) -> None:
        header = " status ,ticket_id,date,client_company,category,description,agent_id,customer_email,satisfaction_score\n"
        line = "OPEN,NXV-000001,2026-08-01,Acme,TECHNICAL,Printer broken,AGT-01,a@example.invalid,\n"
        self.assertEqual(analyze_stream([header, line]).valid_records, 1)

    def test_short_row_is_filled_with_empty_values(self) -> None:
        result = analyze_stream([HEADER, "NXV-000001,2026-08-01,Acme\n"])
        self.assertEqual(result.invalid_records, 1)
        self.assertEqual(result.rule_count(Rule.INVALID_EMAIL), 1)

    def test_blank_lines_are_not_records(self) -> None:
        self.assertEqual(analyze_stream([HEADER, "\n", VALID_LINE, "\n"]).total_records, 1)

    def test_empty_file_raises(self) -> None:
        with self.assertRaisesRegex(IncidentFileError, "empty"):
            analyze_stream([])

    def test_missing_columns_are_named(self) -> None:
        with self.assertRaises(IncidentFileError) as caught:
            analyze_stream(["ticket_id,date\n", "NXV-000001,2026-08-01\n"])
        self.assertIn("customer_email", str(caught.exception))
        self.assertIn("satisfaction_score", str(caught.exception))


class AnalyzeFileTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.path = Path(self._tmp.name) / "incidents.csv"

    def test_utf8_bom_is_accepted(self) -> None:
        self.path.write_bytes(b"\xef\xbb\xbf" + (HEADER + VALID_LINE).encode("utf-8"))
        self.assertEqual(analyze_file(self.path).valid_records, 1)

    def test_crlf_line_endings_are_accepted(self) -> None:
        self.path.write_bytes((HEADER + VALID_LINE).replace("\n", "\r\n").encode("utf-8"))
        self.assertEqual(analyze_file(self.path).valid_records, 1)

    def test_non_utf8_file_raises_without_content_or_chained_exception(self) -> None:
        self.path.write_bytes(HEADER.encode("utf-8") + "NXV-1,x,Caf\xe9,secret@example.invalid\n".encode("latin-1"))
        with self.assertRaises(IncidentFileError) as caught:
            analyze_file(self.path)
        self.assertNotIn("secret", str(caught.exception))
        self.assertIsNone(caught.exception.__cause__)
        self.assertIsNone(caught.exception.__context__)

    def test_missing_file_raises_os_error(self) -> None:
        with self.assertRaises(FileNotFoundError):
            analyze_file(self.path)


if __name__ == "__main__":
    unittest.main()
