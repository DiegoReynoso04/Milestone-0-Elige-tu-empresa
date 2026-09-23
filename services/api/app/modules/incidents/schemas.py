"""Contrato JSON de `POST /api/incidents/analyze` (ver services/api/SPECS.md).

Solo traduce `AnalysisResult` a JSON; no calcula nada. Porcentajes y media se
devuelven como el string decimal que ya produce el núcleo (D-API-2), así el
frontend no repite reglas de redondeo. `null` cuando no son calculables.
"""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from .store import StoredAnalysis

EXPORT_FILENAME = "results.csv"
EXPORT_FORMAT = "metric,value"


class Totals(BaseModel):
    total_records: int
    valid_records: int
    invalid_records: int


class RuleBreakdownItem(BaseModel):
    code: str
    label: str
    count: int


class CategoryItem(BaseModel):
    code: str
    count: int
    percentage: str | None


class StatusItem(BaseModel):
    code: str
    count: int
    percentage: str | None


class ScoreItem(BaseModel):
    score: int
    label: str
    count: int


class Satisfaction(BaseModel):
    closed_tickets: int
    scored_tickets: int
    average_score: str | None
    distribution: list[ScoreItem]


class ExportInfo(BaseModel):
    available: bool
    url: str
    filename: str
    format: str


class AnalysisResponse(BaseModel):
    analysis_id: UUID
    analyzed_at: datetime
    totals: Totals
    invalid_breakdown: list[RuleBreakdownItem]
    categories: list[CategoryItem]
    statuses: list[StatusItem]
    satisfaction: Satisfaction
    export: ExportInfo

    @classmethod
    def from_stored(cls, stored: StoredAnalysis, export_url: str) -> "AnalysisResponse":
        result = stored.result
        satisfaction = result.satisfaction
        return cls(
            analysis_id=stored.analysis_id,
            analyzed_at=stored.analyzed_at,
            totals=Totals(
                total_records=result.total_records,
                valid_records=result.valid_records,
                invalid_records=result.invalid_records,
            ),
            invalid_breakdown=[
                RuleBreakdownItem(code=item.rule.code, label=item.rule.label, count=item.count)
                for item in result.invalid_breakdown
            ],
            categories=[
                CategoryItem(code=item.category.value, count=item.count, percentage=_text(item.percentage))
                for item in result.categories
            ],
            statuses=[
                StatusItem(code=item.status.value, count=item.count, percentage=_text(item.percentage))
                for item in result.statuses
            ],
            satisfaction=Satisfaction(
                closed_tickets=satisfaction.closed_tickets,
                scored_tickets=satisfaction.scored_tickets,
                average_score=_text(satisfaction.average_score),
                distribution=[
                    ScoreItem(score=item.score, label=item.label, count=item.count)
                    for item in satisfaction.distribution
                ],
            ),
            export=ExportInfo(available=True, url=export_url, filename=EXPORT_FILENAME, format=EXPORT_FORMAT),
        )


def _text(value: Decimal | None) -> str | None:
    return None if value is None else str(value)
