"""Agregados del análisis. Solo conteos: ninguna estructura guarda filas.

Porcentajes sobre registros válidos, con 1 decimal; media de satisfacción con
2 decimales. Ambos con `Decimal` y ROUND_HALF_UP explícito, para no depender
del redondeo "al par" de `round()`.
"""

from collections import Counter
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from .schema import SCORE_LABELS, Category, IncidentRow, Rule, Status
from .validation import ValidationResult, parse_score

_PERCENTAGE_QUANTUM = Decimal("0.1")
_AVERAGE_QUANTUM = Decimal("0.01")
_VALID_STATUSES = frozenset(status.value for status in Status)


@dataclass(frozen=True, slots=True)
class RuleCount:
    rule: Rule
    count: int


@dataclass(frozen=True, slots=True)
class CategoryCount:
    category: Category
    count: int
    percentage: Decimal | None  # None si no hay registros válidos


@dataclass(frozen=True, slots=True)
class StatusCount:
    status: Status
    count: int
    percentage: Decimal | None


@dataclass(frozen=True, slots=True)
class ScoreCount:
    score: int
    label: str
    count: int


@dataclass(frozen=True, slots=True)
class SatisfactionSummary:
    """Índice de satisfacción de los tickets CLOSED válidos.

    Una puntuación válida en OPEN/DISCARDED no participa (decisión D4).
    """

    closed_tickets: int
    scored_tickets: int
    average_score: Decimal | None  # None si no hay tickets puntuados
    distribution: tuple[ScoreCount, ...]


@dataclass(frozen=True, slots=True)
class AnalysisResult:
    total_records: int
    valid_records: int
    # Filas distintas. El desglose por regla cuenta activaciones, así que su
    # suma puede superar este número (decisión D1).
    invalid_records: int
    invalid_breakdown: tuple[RuleCount, ...]
    categories: tuple[CategoryCount, ...]
    # Solo OPEN/CLOSED/DISCARDED. Un válido con otro status no suma aquí
    # (decisión D3), así que estos conteos pueden sumar menos que valid_records.
    statuses: tuple[StatusCount, ...]
    satisfaction: SatisfactionSummary

    def rule_count(self, rule: Rule) -> int:
        return next(item.count for item in self.invalid_breakdown if item.rule is rule)

    def category(self, category: Category) -> CategoryCount:
        return next(item for item in self.categories if item.category is category)

    def status(self, status: Status) -> StatusCount:
        return next(item for item in self.statuses if item.status is status)

    def score(self, score: int) -> ScoreCount:
        return next(item for item in self.satisfaction.distribution if item.score == score)


def percentage(part: int, whole: int) -> Decimal | None:
    if whole == 0:
        return None
    return (Decimal(part) * 100 / Decimal(whole)).quantize(_PERCENTAGE_QUANTUM, rounding=ROUND_HALF_UP)


def average(total: int, count: int) -> Decimal | None:
    if count == 0:
        return None
    return (Decimal(total) / Decimal(count)).quantize(_AVERAGE_QUANTUM, rounding=ROUND_HALF_UP)


class MetricsAccumulator:
    """Acumula fila a fila y descarta la fila: nunca retiene datos de registros."""

    def __init__(self) -> None:
        self._total = 0
        self._invalid = 0
        self._rules: Counter[Rule] = Counter()
        self._categories: Counter[Category] = Counter()
        self._statuses: Counter[Status] = Counter()
        self._closed = 0
        self._scores: Counter[int] = Counter()

    def add(self, row: IncidentRow, validation: ValidationResult) -> None:
        self._total += 1
        if not validation.is_valid:
            self._invalid += 1
            self._rules.update(validation.violations)
            return

        # En una fila válida, category es una de las 5 y el score es vacío o 1–5.
        self._categories[Category(row.category)] += 1
        if row.status not in _VALID_STATUSES:
            return
        status = Status(row.status)
        self._statuses[status] += 1
        if status is Status.CLOSED:
            self._closed += 1
            score = parse_score(row.satisfaction_score)
            if score is not None:
                self._scores[score] += 1

    def result(self) -> AnalysisResult:
        valid = self._total - self._invalid
        scored = sum(self._scores.values())
        score_total = sum(score * count for score, count in self._scores.items())
        return AnalysisResult(
            total_records=self._total,
            valid_records=valid,
            invalid_records=self._invalid,
            invalid_breakdown=tuple(RuleCount(rule, self._rules[rule]) for rule in Rule),
            categories=tuple(
                CategoryCount(category, self._categories[category], percentage(self._categories[category], valid))
                for category in Category
            ),
            statuses=tuple(
                StatusCount(status, self._statuses[status], percentage(self._statuses[status], valid))
                for status in Status
            ),
            satisfaction=SatisfactionSummary(
                closed_tickets=self._closed,
                scored_tickets=scored,
                average_score=average(score_total, scored),
                distribution=tuple(
                    ScoreCount(score, label, self._scores[score]) for score, label in SCORE_LABELS.items()
                ),
            ),
        )
