"""Utilidades compartidas por los tests. Solo datos ficticios (`example.invalid`)."""

import csv
from pathlib import Path

from incident_analyzer import IncidentRow

PACKAGE_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = PACKAGE_ROOT.parent.parent
FIXTURE = PACKAGE_ROOT / "tests" / "fixtures" / "incidents-synthetic.csv"
CLI = REPO_ROOT / "scripts" / "analyze.py"


def fixture_emails() -> list[str]:
    """Todos los valores no vacíos de `customer_email` del fixture, válidos o no."""
    with FIXTURE.open(encoding="utf-8", newline="") as stream:
        return [row["customer_email"] for row in csv.DictReader(stream) if row["customer_email"]]


def make_row(row_number: int = 2, **overrides: str) -> IncidentRow:
    """Una fila válida (OPEN, sin score); `overrides` cambia campos concretos."""
    values = {
        "ticket_id": "NXV-000001",
        "date": "2026-08-01",
        "client_company": "Acme Retail",
        "category": "TECHNICAL",
        "description": "Printer not responding",
        "agent_id": "AGT-07",
        "status": "OPEN",
        "customer_email": "someone@example.invalid",
        "satisfaction_score": "",
    }
    values.update(overrides)
    return IncidentRow(row_number=row_number, **values)


def csv_lines(*rows: IncidentRow) -> list[str]:
    """Serializa filas a líneas CSV (con cabecera) para `analyze_stream`."""
    header = "ticket_id,date,client_company,category,description,agent_id,status,customer_email,satisfaction_score"
    body = [
        ",".join(
            (
                row.ticket_id,
                row.date,
                row.client_company,
                row.category,
                row.description,
                row.agent_id,
                row.status,
                row.customer_email,
                row.satisfaction_score,
            )
        )
        for row in rows
    ]
    return [line + "\n" for line in (header, *body)]
