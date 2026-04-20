from __future__ import annotations

import io
import json
from typing import Any

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import UserContext, ensure_profile
from app.core.database import get_db
from app.models.models import Contract, ImportColumnMapping, ImportSession, ImportStatus
from app.schemas.imports import (
    CANONICAL_FIELDS,
    ImportExecuteResponse,
    ImportMappingConfirmationRequest,
    ImportMappingProposalResponse,
    MappingProposal,
    REQUIRED_IMPORT_FIELDS,
)
from app.services.llm_gateway import chat_json_with_fallback
from app.services.import_processor import confirm_mapping_and_import

router = APIRouter(prefix="/imports", tags=["imports"])

PROMPT_VERSION = "v1"


def _read_tabular_file(filename: str, file_content: bytes) -> pd.DataFrame:
    lower_name = filename.lower()
    if lower_name.endswith(".csv"):
        return pd.read_csv(io.BytesIO(file_content))
    if lower_name.endswith(".xlsx"):
        return pd.read_excel(io.BytesIO(file_content))
    raise ValueError("Unsupported file type. Allowed extensions: .csv, .xlsx")


def _to_json_safe_records(df: pd.DataFrame, limit: int | None = None) -> list[dict[str, Any]]:
    safe_df = df.head(limit) if limit is not None else df
    # Convert NaN/NaT to None first, then coerce non-JSON scalar types (Timestamp, etc.) via default=str.
    records = safe_df.where(pd.notna(safe_df), None).to_dict(orient="records")
    return json.loads(json.dumps(records, default=str))


def _contract_model_fields() -> list[str]:
    excluded = {
        "id",
        "owner_user_id",
        "created_at",
        "updated_at",
        "source_file_name",
        "source_row_number",
    }
    return [column.name for column in Contract.__table__.columns if column.name not in excluded]


def _build_system_prompt(source_columns: list[str], contract_fields: list[str]) -> str:
    return (
        "Jesteś ekspertem od danych w branży nieruchomości (billboardy). "
        f"Dostałeś listę nagłówków z polskiego pliku Excel: {source_columns}. "
        "Twoim zadaniem jest zmapowanie ich na pola w naszej bazie danych: "
        f"{contract_fields}. "
        "Zwróć wynik w formacie JSON: listę obiektów z polami: "
        "source_column_name, target_field_name, confidence_score, transform_hint."
    )


def _build_user_prompt(sample_rows: list[dict[str, Any]]) -> str:
    return json.dumps(
        {
            "sample_rows": sample_rows[:2],
            "required_fields": sorted(REQUIRED_IMPORT_FIELDS),
            "allowed_target_fields": CANONICAL_FIELDS,
            "rules": [
                "Output strict JSON object with key 'proposals'.",
                "confidence_score must be a float between 0 and 1.",
                "If no mapping is found, set target_field_name to null.",
                "Keep transform_hint concise (e.g. 'dd.mm.yyyy' or null).",
            ],
            "output_schema": {
                "proposals": [
                    {
                        "source_column_name": "string",
                        "target_field_name": "string|null",
                        "confidence_score": "number 0..1",
                        "transform_hint": "string|null",
                    }
                ]
            },
        },
        ensure_ascii=True,
    )


def _fallback_proposals(source_columns: list[str]) -> list[MappingProposal]:
    proposals: list[MappingProposal] = []
    for source_column in source_columns:
        proposals.append(
            MappingProposal(
                source_column_name=source_column,
                target_field_name=None,
                guessed_confidence=0.2,
                guessed_rationale="Fallback used. Manual mapping required.",
                transform_hint=None,
                is_required_target=False,
            )
        )
    return proposals


def _safe_confidence(value: Any) -> float:
    try:
        score = float(value)
    except (TypeError, ValueError):
        return 0.2
    return max(0.0, min(1.0, score))


def _proposal_from_llm_item(item: dict[str, Any]) -> MappingProposal:
    target = item.get("target_field_name")
    if target is not None:
        target = str(target).strip() or None
    return MappingProposal(
        source_column_name=str(item.get("source_column_name", "")),
        target_field_name=target,
        guessed_confidence=_safe_confidence(item.get("confidence_score")),
        guessed_rationale="LLM mapping suggestion.",
        transform_hint=item.get("transform_hint"),
        is_required_target=bool(target and target in REQUIRED_IMPORT_FIELDS),
    )


def _guess_mapping_with_gpt(source_columns: list[str], sample_rows: list[dict[str, Any]]) -> tuple[list[MappingProposal], str, str | None]:
    fallback = _fallback_proposals(source_columns)

    contract_fields = _contract_model_fields()
    system_prompt = _build_system_prompt(source_columns, contract_fields)
    user_prompt = _build_user_prompt(sample_rows)
    try:
        parsed, used_model = chat_json_with_fallback(
            use_case="import",
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.1,
        )
        proposals = [_proposal_from_llm_item(item) for item in parsed.get("proposals", [])]
        if not proposals:
            return fallback, used_model, "Model returned empty proposals, fallback used."
        return proposals, used_model, None
    except Exception as exc:  # noqa: BLE001
        return fallback, "heuristic-fallback", f"LLM mapping failed, fallback used: {exc}"


async def generate_mapping_proposal(
    db: AsyncSession, user_id: str, file: UploadFile
) -> ImportMappingProposalResponse:
    file_bytes = await file.read()
    if not file_bytes:
        raise ValueError("Uploaded file is empty.")

    file_name = file.filename or "uploaded-file"
    df = _read_tabular_file(file_name, file_bytes)
    source_columns = [str(column) for column in df.columns.tolist()]
    sample_rows = _to_json_safe_records(df, limit=2)

    proposals, guessed_by_model, warning = _guess_mapping_with_gpt(source_columns, sample_rows)

    import_session = ImportSession(
        owner_user_id=user_id,
        original_file_name=file_name,
        file_type="xlsx" if file_name.lower().endswith(".xlsx") else "csv",
        status=ImportStatus.mapped,
        total_rows=int(len(df.index)),
        llm_model=guessed_by_model,
        llm_prompt_version=PROMPT_VERSION,
        storage_path=json.dumps(
            {
                "source_columns": source_columns,
                "sample_rows": sample_rows,
                "all_rows": _to_json_safe_records(df),
            },
            ensure_ascii=False,
        ),
    )
    db.add(import_session)
    await db.flush()

    db.add_all(
        [
            ImportColumnMapping(
                import_session_id=import_session.id,
                owner_user_id=user_id,
                source_column_name=proposal.source_column_name,
                target_field_name=proposal.target_field_name,
                guessed_confidence=proposal.guessed_confidence,
                guessed_rationale=proposal.guessed_rationale,
                transform_hint=proposal.transform_hint,
                is_required_target=proposal.is_required_target,
                confirmed_by_user=False,
                user_override=False,
            )
            for proposal in proposals
        ]
    )

    await db.commit()

    return ImportMappingProposalResponse(
        session_id=import_session.id,
        file_name=import_session.original_file_name,
        owner_user_id=user_id,
        total_rows=import_session.total_rows,
        columns=source_columns,
        mapping_suggestions=proposals,
        guessed_by_model=guessed_by_model,
        warning=warning,
    )


@router.post("/guess-mapping", response_model=ImportMappingProposalResponse)
async def guess_mapping(
    file: UploadFile = File(...),
    user: UserContext = Depends(ensure_profile),
    db: AsyncSession = Depends(get_db),
) -> ImportMappingProposalResponse:
    try:
        return await generate_mapping_proposal(db=db, user_id=user.user_id, file=file)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post("/confirm-mapping", response_model=ImportExecuteResponse)
async def confirm_mapping(
    payload: ImportMappingConfirmationRequest,
    user: UserContext = Depends(ensure_profile),
    db: AsyncSession = Depends(get_db),
) -> ImportExecuteResponse:
    if payload.owner_user_id != user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only confirm your own import sessions.",
        )

    try:
        return await confirm_mapping_and_import(db=db, payload=payload)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
