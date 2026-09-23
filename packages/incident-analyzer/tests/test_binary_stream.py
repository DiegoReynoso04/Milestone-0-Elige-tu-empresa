import io
import unittest

from incident_analyzer import IncidentFileError, analyze_binary_stream, analyze_file

from .support import FIXTURE

HEADER = "ticket_id,date,client_company,category,description,agent_id,status,customer_email,satisfaction_score\n"
VALID_LINE = "NXV-000001,2026-08-01,Acme,TECHNICAL,Printer broken,AGT-01,CLOSED,a@example.invalid,4\n"


class AnalyzeBinaryStreamTests(unittest.TestCase):
    def test_same_result_as_analyze_file(self) -> None:
        self.assertEqual(analyze_binary_stream(io.BytesIO(FIXTURE.read_bytes())), analyze_file(FIXTURE))

    def test_utf8_bom_is_accepted(self) -> None:
        data = b"\xef\xbb\xbf" + (HEADER + VALID_LINE).encode("utf-8")
        self.assertEqual(analyze_binary_stream(io.BytesIO(data)).valid_records, 1)

    def test_crlf_gives_the_same_result_as_lf(self) -> None:
        lf = (HEADER + VALID_LINE).encode("utf-8")
        crlf = lf.replace(b"\n", b"\r\n")
        self.assertEqual(analyze_binary_stream(io.BytesIO(crlf)), analyze_binary_stream(io.BytesIO(lf)))

    def test_quoted_multiline_field_is_preserved(self) -> None:
        line = 'NXV-000001,2026-08-01,Acme,TECHNICAL,"Line one\r\nline two",AGT-01,OPEN,a@example.invalid,\r\n'
        result = analyze_binary_stream(io.BytesIO((HEADER + line).encode("utf-8")))
        self.assertEqual((result.total_records, result.valid_records), (1, 1))

    def test_invalid_utf8_raises_without_content_or_chained_exception(self) -> None:
        data = HEADER.encode("utf-8") + "NXV-1,x,Caf\xe9,secret@example.invalid\n".encode("latin-1")
        with self.assertRaises(IncidentFileError) as caught:
            analyze_binary_stream(io.BytesIO(data))
        self.assertEqual(str(caught.exception), "the file is not valid UTF-8")
        self.assertNotIn("secret", str(caught.exception))
        self.assertIsNone(caught.exception.__cause__)
        self.assertIsNone(caught.exception.__context__)

    def test_caller_stream_is_not_closed(self) -> None:
        stream = io.BytesIO((HEADER + VALID_LINE).encode("utf-8"))
        analyze_binary_stream(stream)
        self.assertFalse(stream.closed)

    def test_caller_stream_is_not_closed_on_error(self) -> None:
        stream = io.BytesIO(b"")
        with self.assertRaises(IncidentFileError):
            analyze_binary_stream(stream)
        self.assertFalse(stream.closed)


if __name__ == "__main__":
    unittest.main()
