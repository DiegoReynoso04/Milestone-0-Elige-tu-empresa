"""Último análisis del proceso, en memoria (decisiones D-API-5 y D-API-6).

Guarda el último análisis que **termina correctamente**: con peticiones
concurrentes gana la que termina después, no la que empezó después.

No es persistencia: se pierde al reiniciar, es global al proceso (no por
usuario) y exige ejecutar la API con un único worker. Solo guarda metadatos
de la API y el `AnalysisResult` (conteos): ni el CSV ni sus bytes.
"""

import threading
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from incident_analyzer import AnalysisResult


@dataclass(frozen=True, slots=True)
class StoredAnalysis:
    analysis_id: uuid.UUID
    analyzed_at: datetime
    result: AnalysisResult


class LastResultStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._latest: StoredAnalysis | None = None

    def save(self, result: AnalysisResult) -> StoredAnalysis:
        stored = StoredAnalysis(
            analysis_id=uuid.uuid4(),
            analyzed_at=datetime.now(UTC).replace(microsecond=0),
            result=result,
        )
        with self._lock:
            self._latest = stored
        return stored

    def latest(self) -> StoredAnalysis | None:
        with self._lock:
            return self._latest
