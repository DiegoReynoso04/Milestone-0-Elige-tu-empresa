"""Exportación `metric,value`: una métrica por fila, solo agregados.

Nunca contiene datos de registros (emails, descripciones, ticket IDs...):
se construye exclusivamente a partir de `AnalysisResult`, que solo guarda
conteos.
"""

import csv
import io
from dataclasses import dataclass
from decimal import Decimal
from os import PathLike

from .metrics import AnalysisResult

HEADER = ("metric", "value")
NOT_AVAILABLE = "N/A"
# Prefijos que Excel/Sheets interpretan como fórmula (OWASP "CSV Injection").
_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


@dataclass(frozen=True, slots=True)
class ExportMetric:
    name: str
    value: str


def _value(value: int | Decimal | None) -> str:
    return NOT_AVAILABLE if value is None else str(value)


def build_export_metrics(result: AnalysisResult) -> tuple[ExportMetric, ...]:
    satisfaction = result.satisfaction
    metrics = [
        ExportMetric("total_records", _value(result.total_records)),
        ExportMetric("valid_records", _value(result.valid_records)),
        ExportMetric("invalid_records", _value(result.invalid_records)),
    ]
    metrics += [ExportMetric(f"rule_{item.rule.code}", _value(item.count)) for item in result.invalid_breakdown]
    for category in result.categories:
        prefix = f"category_{category.category.value.lower()}"
        metrics.append(ExportMetric(f"{prefix}_count", _value(category.count)))
        metrics.append(ExportMetric(f"{prefix}_pct", _value(category.percentage)))
    for status in result.statuses:
        prefix = f"status_{status.status.value.lower()}"
        metrics.append(ExportMetric(f"{prefix}_count", _value(status.count)))
        metrics.append(ExportMetric(f"{prefix}_pct", _value(status.percentage)))
    metrics += [
        ExportMetric("satisfaction_closed_tickets", _value(satisfaction.closed_tickets)),
        ExportMetric("satisfaction_scored_tickets", _value(satisfaction.scored_tickets)),
        ExportMetric("satisfaction_average_score", _value(satisfaction.average_score)),
    ]
    metrics += [
        ExportMetric(f"satisfaction_score_{item.score}_count", _value(item.count))
        for item in satisfaction.distribution
    ]
    return tuple(metrics)


def neutralize_formula(cell: str) -> str:
    """Antepone `'` a una celda que una hoja de cálculo ejecutaría como fórmula."""
    return f"'{cell}" if cell.startswith(_FORMULA_PREFIXES) else cell


def render_results_csv(result: AnalysisResult) -> str:
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer)
    writer.writerow(HEADER)
    for metric in build_export_metrics(result):
        writer.writerow((neutralize_formula(metric.name), neutralize_formula(metric.value)))
    return buffer.getvalue()


def write_results_csv(result: AnalysisResult, path: str | PathLike[str]) -> None:
    with open(path, "w", encoding="utf-8", newline="") as stream:
        stream.write(render_results_csv(result))
