"""
Known multi-sheet outdoor portfolio layout (fingerprinted headers only).

Fingerprints were derived from normalized column names; do not embed supplier filenames.
"""

from __future__ import annotations

import io
import json
from dataclasses import dataclass
from typing import Any

import pandas as pd

from app.schemas.imports import REQUIRED_IMPORT_FIELDS, MappingProposal
from app.services.import_adapters.fingerprint import header_fingerprint_from_column_names, normalize_header_token
from app.services.import_excel import is_probable_month_column

ADAPTER_ID = "known_workbook_v1"
ADAPTER_VERSION = 1
GUESSED_BY = f"adapter:{ADAPTER_ID}"

# Sheets with this header layout (verified against a local reference workbook; hashes only in repo).
HEADER_FINGERPRINTS: frozenset[str] = frozenset(
    {
        "6874364c04683cda61fc17a14b566600",
        "f03aee1f16ae5d1ef1d1d972442f1bba",
        "3dd7069b55b77cb9f6a02631a073ae23",
        "3d39f8105f78c7fcd7b62740452e3e53",
        "d27aed3b3f17411f5327e602a7a82d22",
    }
)

# Normalized column token -> canonical import field (after preprocess_dataframe renames).
_TARGET_BY_TOKEN: dict[str, str | None] = {
    "l_p": "contract_number",
    "miasto": "city",
    "lokalizacja": "location_address",
    "uwagi": "notes",
    "powierzchnia": "surface_size",
    "wynajmujacy": "property_owner_name",
    "osoba_kontaktowa": "contact_person",
    "telefon_osoby_kontaktowej": "contact_phone",
    "e_mail_osoby_kontaktowej": "contact_email",
    "czas_trwania_umowy": "expiry_date",
    "koszt_miesieczny_netto": "monthly_rent_net",
    "koszt_za_caly_okres_trwania_umowy": "total_contract_value_net",
}


@dataclass
class AdapterLoadResult:
    source_columns: list[str]
    all_rows: list[dict[str, Any]]
    proposals: list[MappingProposal]
    parse_options: dict[str, Any]
    guessed_by_model: str
    warning: str | None = None


def _resolve_sheet_name(xf: pd.ExcelFile, sheet_name: str) -> str | int:
    sn = (sheet_name or "").strip()
    if sn and sn in xf.sheet_names:
        return sn
    if sn.isdigit():
        idx = int(sn)
        if 0 <= idx < len(xf.sheet_names):
            return xf.sheet_names[idx]
    return xf.sheet_names[0] if xf.sheet_names else 0


def matches_xlsx(file_name: str, file_bytes: bytes, sheet_name: str) -> bool:
    if not file_name.lower().endswith((".xlsx", ".xls")):
        return False
    try:
        xf = pd.ExcelFile(io.BytesIO(file_bytes))
    except Exception:  # noqa: BLE001
        return False
    if not xf.sheet_names:
        return False
    sn = _resolve_sheet_name(xf, sheet_name)
    try:
        df0 = pd.read_excel(xf, sheet_name=sn, header=0, nrows=0)
    except Exception:  # noqa: BLE001
        return False
    fp = header_fingerprint_from_column_names(list(df0.columns))
    return fp in HEADER_FINGERPRINTS


def preprocess_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    if "koszt na mc" in out.columns:
        out = out.rename(columns={"koszt na mc": "koszt miesięczny netto"})
    pay_col = "uwagi dot. płatności"
    if pay_col in out.columns:
        pay = out[pay_col].fillna("").astype(str).str.strip()
        if "uwagi" in out.columns:
            base = out["uwagi"].fillna("").astype(str).str.strip()
            combined = (base + " | " + pay).str.replace(r"^\s*\|\s*|\s*\|\s*$", "", regex=True)
            out["uwagi"] = combined.str.strip()
        else:
            out["uwagi"] = pay
        out = out.drop(columns=[pay_col])
    if "Unnamed: 1" in out.columns and "miasto" not in out.columns:
        out = out.rename(columns={"Unnamed: 1": "miasto"})
    status_col = "status lipiec 2022"
    if status_col in out.columns:
        out = out.drop(columns=[status_col])
    month_cols = [c for c in out.columns if is_probable_month_column(str(c))]
    if month_cols:
        out = out.drop(columns=month_cols)
    return out


def _build_proposals(columns: list[str]) -> list[MappingProposal]:
    proposals: list[MappingProposal] = []
    for col in columns:
        token = normalize_header_token(col)
        target = _TARGET_BY_TOKEN.get(token)
        is_required = bool(target and target in REQUIRED_IMPORT_FIELDS)
        if target:
            rationale = f"Preset mapping for known workbook ({ADAPTER_ID})."
            confidence = 0.99
        else:
            rationale = "Column not mapped by known-workbook adapter."
            confidence = 0.15
        proposals.append(
            MappingProposal(
                source_column_name=str(col),
                target_field_name=target,
                guessed_confidence=confidence,
                guessed_rationale=rationale,
                transform_hint=None,
                is_required_target=is_required,
            )
        )
    return proposals


def load_workbook(file_bytes: bytes, sheet_name: str) -> AdapterLoadResult:
    xf = pd.ExcelFile(io.BytesIO(file_bytes))
    sn = _resolve_sheet_name(xf, sheet_name)
    df0 = pd.read_excel(xf, sheet_name=sn, header=0, nrows=0)
    fp = header_fingerprint_from_column_names(list(df0.columns))
    df = pd.read_excel(io.BytesIO(file_bytes), sheet_name=sn, header=0)
    df = df.dropna(how="all")
    df = preprocess_dataframe(df)
    records = json.loads(json.dumps(df.where(pd.notna(df), None).to_dict(orient="records"), default=str))
    proposals = _build_proposals([str(c) for c in df.columns])
    parse_options: dict[str, Any] = {
        "adapter_id": ADAPTER_ID,
        "adapter_version": ADAPTER_VERSION,
        "header_fingerprint": fp,
        "resolved_sheet": sn if isinstance(sn, str) else str(sn),
        "sheet_name": sheet_name.strip() or None,
        "unpivot_month_columns": False,
        "unpivot_applied": True,
        "monthly_aggregate": "mean",
        "header_row_1based": 1,
        "header_row_requested": 1,
        "header_auto": False,
        "skip_rows_before_header": 0,
    }
    return AdapterLoadResult(
        source_columns=[str(c) for c in df.columns],
        all_rows=records,
        proposals=proposals,
        parse_options=parse_options,
        guessed_by_model=GUESSED_BY,
        warning=None,
    )
