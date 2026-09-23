"""Núcleo de análisis del CSV de incidentes de soporte de Nexova.

Contexto funcional: docs/COMPANY_INCIDENT_FILE_ANALIZER_PROJECT.md.
Solo librería estándar. Ningún módulo imprime ni registra: el reporte y la
exportación se devuelven como texto o se escriben donde indique quien llama.
"""

from .analyze import analyze_file, analyze_stream
from .export import ExportMetric, build_export_metrics, render_results_csv, write_results_csv
from .metrics import (
    AnalysisResult,
    CategoryCount,
    RuleCount,
    SatisfactionSummary,
    ScoreCount,
    StatusCount,
)
from .reader import IncidentFileError
from .report import render_report
from .schema import Category, IncidentRow, Rule, Status
from .validation import ValidationResult, validate_row

__all__ = [
    "AnalysisResult",
    "Category",
    "CategoryCount",
    "ExportMetric",
    "IncidentFileError",
    "IncidentRow",
    "Rule",
    "RuleCount",
    "SatisfactionSummary",
    "ScoreCount",
    "Status",
    "StatusCount",
    "ValidationResult",
    "analyze_file",
    "analyze_stream",
    "build_export_metrics",
    "render_report",
    "render_results_csv",
    "validate_row",
    "write_results_csv",
]
