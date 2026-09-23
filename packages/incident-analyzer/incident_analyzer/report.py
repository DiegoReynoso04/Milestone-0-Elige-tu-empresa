"""Reporte de consola con el formato de "Salida esperada" del documento.

Devuelve texto; no imprime. Las 7 reglas se muestran siempre, también con 0
(decisión D2).
"""

from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal

from .metrics import AnalysisResult


@dataclass(frozen=True, slots=True)
class _Glyphs:
    rule: str
    dash: str
    branch: str
    last: str


_UNICODE = _Glyphs(rule="=" * 60, dash="—", branch="├─", last="└─")
# Para consolas que no pueden codificar los caracteres de caja (cp1252 en
# Windows cuando la salida va a una tubería o a un archivo).
_ASCII = _Glyphs(rule="=" * 60, dash="-", branch="|-", last="`-")

# Columna donde acaban los puntos; cabe la etiqueta más larga
# ("  └─ Invalid or missing description", 35 caracteres).
_LEADER_WIDTH = 40
_VALUE_WIDTH = 4


def _leader(text: str, value: object) -> str:
    dots = "." * max(_LEADER_WIDTH - len(text) - 2, 3)
    return f"{text} {dots} {value!s:>{_VALUE_WIDTH}}"


def _tree(glyphs: _Glyphs, items: Sequence[tuple[str, object, str]]) -> list[str]:
    lines = []
    for index, (label, value, suffix) in enumerate(items):
        glyph = glyphs.last if index == len(items) - 1 else glyphs.branch
        lines.append(_leader(f"  {glyph} {label}", value) + suffix)
    return lines


def _percentage(value: Decimal | None) -> str:
    return "  (n/a)" if value is None else f"  ({value}%)"


def render_report(result: AnalysisResult, source_name: str, *, ascii_only: bool = False) -> str:
    glyphs = _ASCII if ascii_only else _UNICODE
    satisfaction = result.satisfaction
    average = "n/a" if satisfaction.average_score is None else f"{satisfaction.average_score}"

    lines = [
        glyphs.rule,
        f"  NEXOVA {glyphs.dash} SUPPORT TICKET ANALYSIS",
        f"  Source file: {source_name}",
        glyphs.rule,
        "",
        _leader("TOTAL RECORDS IN FILE", result.total_records),
        *_tree(
            glyphs,
            [
                ("Valid records", result.valid_records, ""),
                ("Invalid / incomplete", result.invalid_records, ""),
            ],
        ),
        "",
        "INVALID RECORDS BREAKDOWN",
        *_tree(glyphs, [(item.rule.label, item.count, "") for item in result.invalid_breakdown]),
        "",
        "BREAKDOWN BY CATEGORY (valid records)",
        *_tree(
            glyphs,
            [(item.category.value, item.count, _percentage(item.percentage)) for item in result.categories],
        ),
        "",
        "BREAKDOWN BY STATUS (valid records)",
        *_tree(
            glyphs,
            [(item.status.value, item.count, _percentage(item.percentage)) for item in result.statuses],
        ),
        "",
        "SATISFACTION INDEX (closed tickets)",
        f"  Scored tickets: {satisfaction.scored_tickets} of {satisfaction.closed_tickets}",
        f"  Average score: {average} / 5.00",
        *_tree(
            glyphs,
            [(f"Score {item.score} ({item.label})", item.count, "") for item in satisfaction.distribution],
        ),
        "",
        glyphs.rule,
    ]
    return "\n".join(lines)
