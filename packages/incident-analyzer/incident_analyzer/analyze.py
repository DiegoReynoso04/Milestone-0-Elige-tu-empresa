"""Punto de entrada único del análisis: leer → validar → agregar.

Tanto `scripts/analyze.py` como cualquier otro consumidor deben pasar por
aquí, para que todos obtengan exactamente el mismo `AnalysisResult`.
"""

from collections.abc import Iterable
from os import PathLike

from .metrics import AnalysisResult, MetricsAccumulator
from .reader import IncidentFileError, read_rows
from .validation import validate_row

# utf-8-sig acepta el archivo con o sin BOM (exportaciones típicas de Excel).
FILE_ENCODING = "utf-8-sig"


def analyze_stream(lines: Iterable[str]) -> AnalysisResult:
    accumulator = MetricsAccumulator()
    for row in read_rows(lines):
        accumulator.add(row, validate_row(row))
    return accumulator.result()


def analyze_file(path: str | PathLike[str]) -> AnalysisResult:
    """Analiza un CSV del disco. Lanza `OSError` si no se puede abrir."""
    with open(path, encoding=FILE_ENCODING, newline="") as stream:
        try:
            return analyze_stream(stream)
        except UnicodeDecodeError:
            pass
    # Se lanza fuera del `except` para no encadenar la excepción original: su
    # atributo `.object` guarda los bytes leídos, que pueden incluir emails.
    raise IncidentFileError("the file is not valid UTF-8")
