"""Modelos Pydantic del directorio de proveedores de Nexova.

Fuente: docs/ligthweight-storage-api.md ("Modelo de proveedor", "Categorías
válidas", "Estados válidos" y "Restricciones de negocio"). Los nombres de
campos, categorías y estados son exactamente los del documento.

Pydantic valida todo lo que entra: una entrada inválida se rechaza con 422
antes de llegar a TinyDB (ver `app/database.py`).
"""

from datetime import datetime
from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator


class Country(StrEnum):
    SPAIN = "Spain"
    USA = "USA"


class Currency(StrEnum):
    EUR = "EUR"
    USD = "USD"


class SupplierCategory(StrEnum):
    JOB_BOARDS = "job_boards"
    ATS_SOFTWARE = "ats_software"
    ASSESSMENT_TOOLS = "assessment_tools"
    TRAINING_PLATFORMS = "training_platforms"
    PAYROLL_AND_HR_SOFTWARE = "payroll_and_hr_software"
    VIDEO_INTERVIEW = "video_interview"
    BACKGROUND_CHECK = "background_check"
    OFFICE_AND_FACILITIES = "office_and_facilities"
    IT_AND_SOFTWARE_LICENSES = "it_and_software_licenses"


class SupplierStatus(StrEnum):
    ACTIVE = "active"
    SUSPENDED = "suspended"


# Mismas listas y orden que el CONTEXT.
VALID_CATEGORIES = [category.value for category in SupplierCategory]
VALID_STATUSES = [status.value for status in SupplierStatus]

# "Moneda por país": Spain → EUR, USA → USD.
CURRENCY_BY_COUNTRY = {Country.SPAIN: Currency.EUR, Country.USA: Currency.USD}

RENEWAL_DATE_FORMAT = "%Y-%m-%d"

# Campos obligatorios de texto: no vacíos (se ignoran espacios en los extremos).
RequiredText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
# Tarifa: número finito > 0. `strict` rechaza strings como "1200" (sí acepta enteros).
MonthlyRate = Annotated[float, Field(gt=0, strict=True, allow_inf_nan=False)]


class SupplierCreate(BaseModel):
    """Entrada de `POST /suppliers`. `id` y `updated_at` los genera el sistema."""

    model_config = ConfigDict(extra="forbid")

    name: RequiredText
    country: Country
    categories: list[SupplierCategory] = Field(min_length=1)
    monthly_rate: MonthlyRate
    currency: Currency
    status: SupplierStatus
    contract_renewal_date: str | None = None
    contact_email: str | None = None
    notes: str | None = None

    @field_validator("contract_renewal_date")
    @classmethod
    def _renewal_date_is_yyyy_mm_dd(cls, value: str | None) -> str | None:
        if value is None:
            return value
        try:
            parsed = datetime.strptime(value, RENEWAL_DATE_FORMAT)
        except ValueError:
            raise ValueError("contract_renewal_date must be a valid date in YYYY-MM-DD format") from None
        # strptime acepta "2025-3-1": se exige la forma canónica con ceros.
        if parsed.strftime(RENEWAL_DATE_FORMAT) != value:
            raise ValueError("contract_renewal_date must be a valid date in YYYY-MM-DD format")
        return value

    @model_validator(mode="after")
    def _currency_matches_country(self) -> "SupplierCreate":
        expected = CURRENCY_BY_COUNTRY[self.country]
        if self.currency != expected:
            raise ValueError(f"currency must be {expected.value} for suppliers in {self.country.value}")
        return self


class Supplier(SupplierCreate):
    """Proveedor tal como lo devuelve la API: `id` de TinyDB y `updated_at` del sistema."""

    id: int
    updated_at: datetime


class RateUpdate(BaseModel):
    """Entrada de `PATCH /suppliers/{id}/rate`."""

    model_config = ConfigDict(extra="forbid")

    monthly_rate: MonthlyRate


class StatusUpdate(BaseModel):
    """Entrada de `PATCH /suppliers/{id}/status`."""

    model_config = ConfigDict(extra="forbid")

    status: SupplierStatus
