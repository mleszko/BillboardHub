from __future__ import annotations

import io
import json
import re
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any

import pandas as pd
from fastapi import UploadFile
from openai import OpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.models import ImportColumnMapping, ImportSession, ImportStatus
from app.schemas.imports import (
    CANONICAL_FIELDS,
    ImportMappingProposalResponse,
    MappingGuessesResponse,
    MappingProposal,
    REQUIRED_IMPORT_FIELDS,
)

DEFAULT_HEADER_HINTS: dict[str, list[tuple[str, float]]] = {
    "data_wygasniecia": [("expiry_date", 0.95), ("start_date", 0.2)],
    "koniec": [("expiry_date", 0.9)],
    "wygasa": [("expiry_date", 0.86)],
    "data_rozpoczecia": [("start_date", 0.88)],
    "start": [("start_date", 0.78)],
    "reklamodawca": [("advertiser_name", 0.95)],
    "najemca": [("advertiser_name", 0.84)],
    "wlasciciel": [("property_owner_name", 0.88)],
    "adres": [("location_address", 0.85)],
    "miasto": [("city", 0.9)],
    "miejscowosc": [("city", 0.8)],
    "nr_umowy": [("contract_number", 0.9)],
    "numer_umowy": [("contract_number", 0.9)],
    "nosnik": [("billboard_code", 0.82), ("billboard_type", 0.5)],
    "typ": [("billboard_type", 0.8)],
    "czynsz_netto": [("monthly_rent_net", 0.92)],
    "czynsz_brutto": [("monthly_rent_gross", 0.92)],
    "vat": [("vat_rate", 0.9)],
    "waluta": [("currency", 0.9)],
    "uwagi": [("notes", 0.82)],
    "szerokosc_geo": [("latitude", 0.82)],
    "dlugosc_geo": [("longitude", 0.82)],
}


def _normalize_header(header: str) -> str:
    cleaned = header.strip().lower()
    cleaned = cleaned.replace("ł", "l").replace("ą", "a").replace("ć", "c")
    cleaned = cleaned.replace("ę", "e").replace("ń", "n").replace("ó", "o")
    cleaned = cleaned.replace("ś", "s").replace("ż", "z").replace("ź", "z")
    cleaned = re.sub(r"[^a-z0-9]+", "_", cleaned).strip("_")
    return cleaned


def _fallback_guess(columns: list[str]) -> list[MappingProposal]:
    proposals: list[MappingProposal] = []
    for column in columns:
        normalized = _normalize_header(column)
        hints = DEFAULT_HEADER_HINTS.get(normalized, [])
        if hints:
            target, confidence = hints[0]
            rationale = f"Matched normalized Polish header '{normalized}'."
        else:
            target = None
            confidence = 0.2
            rationale = "No confident heuristic match found."
        proposals.append(
            MappingProposal(
                source_column_name=column,
                target_field_name=target,
                guessed_confidence=confidence,
                guessed_rationale=rationale,
                transform_hint=None,
                is_required_target=bool(target and target in REQUIRED_IMPORT_FIELDS),
            )
        )
    return proposals


def _build_prompt(columns: list[str], sample_rows: list[dict[str, Any]]) -> str:
    payload = {
        "task": (
            "Map source columns from a Polish billboard contracts spreadsheet to target schema fields. "
            "Return strict JSON object with key 'proposals' only."
        ),
        "columns": columns,
        "sample_rows": sample_rows[:2],
        "target_fields": CANONICAL_FIELDS,
        "required_fields": sorted(REQUIRED_IMPORT_FIELDS),
        "response_format": {
            "proposals": [
                {
                    "source_column_name": "string",
                    "target_field_name": "string or null",
                    "guessed_confidence": "float 0..1",
                    "guessed_rationale": "short rationale",
                    "transform_hint": "string or null",
                    "is_required_target": "boolean",
                }
            ]
        },
    }
    return json.dumps(payload, ensure_ascii=True)


def _parse_llm_mapping(raw_content: str) -> list[MappingProposal]:
    data = json.loads(raw_content)
    return [MappingProposal(**item) for item in data.get("proposals", [])]


def parse_decimal(value: Any) -> Decimal | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, Decimal):
        return value
    text = str(value).strip().replace(" ", "").replace(",", ".")
    if not text:
        return None
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def parse_date(value: Any) -> date | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, date):
        return value
    parsed = pd.to_datetime(value, errors="coerce", dayfirst=True)
    if pd.isna(parsed):
        return None
    return parsed.date()


def read_dataframe(filename: str, content: bytes) -> pd.DataFrame:
    if filename.lower().endswith(".csv"):
        return pd.read_csv(io.BytesIO(content))
    if filename.lower().endswith(".xlsx"):
        return pd.read_excel(io.BytesIO(content))
    raise ValueError("Unsupported file type. Allowed: .csv, .xlsx")


def sample_payload(df: pd.DataFrame) -> tuple[list[str], list[dict[str, Any]]]:
    columns = [str(c) for c in df.columns.tolist()]
    sampled = df.head(2).fillna("").to_dict(orient="records")
    return columns, sampled


def guess_mapping_with_llm(columns: list[str], sample_rows: list[dict[str, Any]]) -> MappingGuessesResponse:
    settings = get_settings()
    fallback = _fallback_guess(columns)
    if not settings.openai_api_key:
        return MappingGuessesResponse(
            proposals=fallback,
            guessed_by_model="heuristic-fallback",
            prompt_version="v1",
            warning="OPENAI_API_KEY missing, used deterministic fallback matcher.",
        )

    try:
        client = OpenAI(api_key=settings.openai_api_key)
        prompt = _build_prompt(columns, sample_rows)
        completion = client.chat.completions.create(
            model=settings.openai_model,
            response_format={"type": "json_object"},
            temperature=0.1,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a data mapping assistant for Polish billboard contract spreadsheets. "
                        "Always return strict JSON."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
        )
        content = completion.choices[0].message.content or '{"proposals":[]}'
        parsed = _parse_llm_mapping(content)
        if not parsed:
            parsed = fallback
            warning = "Model returned empty proposals; fallback used."
        else:
            warning = None
        return MappingGuessesResponse(
            proposals=parsed,
            guessed_by_model=settings.openai_model,
            prompt_version="v1",
            warning=warning,
        )
    except Exception as exc:  # noqa: BLE001
        return MappingGuessesResponse(
            proposals=fallback,
            guessed_by_model="heuristic-fallback",
            prompt_version="v1",
            warning=f"LLM guess failed, fallback used: {exc}",
        )


def mapping_to_db_rows(
    session: ImportSession, owner_user_id: str, response: MappingGuessesResponse
) -> list[ImportColumnMapping]:
    mappings: list[ImportColumnMapping] = []
    for proposal in response.proposals:
        mappings.append(
            ImportColumnMapping(
                import_session_id=session.id,
                owner_user_id=owner_user_id,
                source_column_name=proposal.source_column_name,
                target_field_name=proposal.target_field_name,
                guessed_confidence=proposal.guessed_confidence,
                guessed_rationale=proposal.guessed_rationale,
                transform_hint=proposal.transform_hint,
                is_required_target=proposal.is_required_target,
                confirmed_by_user=False,
                user_override=False,
            )
        )
    session.status = ImportStatus.MAPPED
    session.llm_model = response.guessed_by_model
    session.llm_prompt_version = response.prompt_version
    return mappings


async def generate_mapping_proposal(
    db: AsyncSession, user_id: str, file: UploadFile
) -> ImportMappingProposalResponse:
    raw_content = await file.read()
    if not raw_content:
        raise ValueError("Uploaded file is empty.")

    file_name = file.filename or "uploaded-file"
    df = read_dataframe(file_name, raw_content)
    columns, sample_rows = sample_payload(df)
    guesses = guess_mapping_with_llm(columns, sample_rows)

    import_session = ImportSession(
        owner_user_id=user_id,
        original_file_name=file_name,
        file_type=("xlsx" if file_name.lower().endswith(".xlsx") else "csv"),
        status=ImportStatus.MAPPED,
        total_rows=int(len(df.index)),
        llm_model=guesses.guessed_by_model,
        llm_prompt_version=guesses.prompt_version,
    )
    db.add(import_session)
    await db.flush()

    mappings = mapping_to_db_rows(import_session, user_id, guesses)
    db.add_all(mappings)

    session_data = {
        "columns": columns,
        "sample_rows": sample_rows,
        "all_rows": df.fillna("").to_dict(orient="records"),
    }
    import_session.storage_path = json.dumps(session_data, ensure_ascii=False)
    await db.commit()

    return ImportMappingProposalResponse(
        session_id=import_session.id,
        owner_user_id=user_id,
        file_name=import_session.original_file_name,
        total_rows=import_session.total_rows,
        columns=columns,
        mapping_suggestions=guesses.proposals,
        guessed_by_model=guesses.guessed_by_model,
        warning=guesses.warning,
    )

