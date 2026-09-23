"""Casos de uso de incidentes. Sin HTTP y sin reglas de negocio propias.

Todo el análisis y la exportación los hace `incident_analyzer`, el mismo
núcleo que usa `scripts/analyze.py`.
"""

from typing import BinaryIO

from incident_analyzer import IncidentFileError, analyze_binary_stream, render_results_csv

from app.core.errors import InvalidCsvError, NoAnalysisError, UnsupportedFileTypeError

from .store import LastResultStore, StoredAnalysis

ACCEPTED_EXTENSION = ".csv"


class IncidentService:
    def __init__(self, store: LastResultStore) -> None:
        self._store = store

    def analyze_upload(self, filename: str | None, stream: BinaryIO) -> StoredAnalysis:
        """Analiza el archivo y, solo si el análisis termina, lo guarda como último."""
        if not filename or not filename.strip().lower().endswith(ACCEPTED_EXTENSION):
            raise UnsupportedFileTypeError()
        try:
            result = analyze_binary_stream(stream)
        except IncidentFileError as error:
            # El mensaje del núcleo es seguro: solo cita columnas o números de fila.
            raise InvalidCsvError(str(error)) from None
        return self._store.save(result)

    def export_latest(self) -> tuple[StoredAnalysis, str]:
        stored = self._store.latest()
        if stored is None:
            raise NoAnalysisError()
        return stored, render_results_csv(stored.result)
