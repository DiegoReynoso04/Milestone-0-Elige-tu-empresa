"""Punto de entrada único del análisis: leer → validar → agregar.

Tanto `scripts/analyze.py` como cualquier otro consumidor (p. ej. la API de
`services/api`) deben pasar por aquí, para que todos obtengan exactamente el
mismo `AnalysisResult`.
"""

import io
from collections.abc import Iterable
from os import PathLike
from typing import BinaryIO

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


def analyze_binary_stream(stream: BinaryIO) -> AnalysisResult:
    """Analiza bytes CSV (archivo abierto en modo binario, upload HTTP...).

    Decodifica como UTF-8 con BOM opcional y conserva los finales de línea
    tal cual (`newline=""`, lo que exige el módulo `csv`). No cierra `stream`:
    es de quien lo abrió.
    """
    text = io.TextIOWrapper(stream, encoding=FILE_ENCODING, newline="")
    try:
        return analyze_stream(text)
    except UnicodeDecodeError:
        pass
    finally:
        text.detach()
    # Se lanza fuera del `except` para no encadenar la excepción original: su
    # atributo `.object` guarda los bytes leídos, que pueden incluir emails.
    raise IncidentFileError("the file is not valid UTF-8")


def analyze_file(path: str | PathLike[str]) -> AnalysisResult:
    """Analiza un CSV del disco. Lanza `OSError` si no se puede abrir."""
    with open(path, "rb") as stream:
        return analyze_binary_stream(stream)
