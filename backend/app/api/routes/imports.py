from __future__ import annotations

import io
import json
from typing import Any

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import UserContext, ensure_profile
from app.core.config import get_settings
from app.core.database import get_db
from app.models.models import Contract, ImportColumnMapping, ImportSession, ImportStatus
from app.schemas.imports import (
    CANONICAL_FIELDS,
    ImportExecuteResponse,
    ImportInspectResponse,
    ImportInspectSheet,
    ImportMappingConfirmationRequest,
    ImportMappingProposalResponse,
    ImportTemplatePreset,
    MappingProposal,
    REQUIRED_IMPORT_FIELDS,
)
from app.services.import_excel import collapse_wide_month_columns, list_excel_sheet_info, read_tabular_dataframe
from app.services.import_guesser import heuristic_mapping_proposals
from app.services.import_processor import confirm_mapping_and_import
from app.services.import_templates import IMPORT_TEMPLATE_PRESETS
from app.services.llm_gateway import chat_json_with_fallback

router = APIRouter(prefix="/imports", tags=["imports"])

PROMPT_VERSION = "v1"


def _to_json_safe_records(df: pd.DataFrame, limit: int | None = None) -> list[dict[str, Any]]:
    safe_df = df.head(limit) if limit is not None else df
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
    settings = get_settings()
    if not settings.import_use_llm:
        proposals = heuristic_mapping_proposals(source_columns)
        return proposals, "local-heuristics", "IMPORT_USE_LLM=false — użyto wyłącznie lokalnych heurystyk (bez wysyłki próbek do modelu)."

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
    db: AsyncSession,
    user_id: str,
    file: UploadFile,
    *,
    sheet_name: str = "",
    header_row_1based: int = 0,
    skip_rows_before_header: int = 0,
    unpivot_month_columns: bool = False,
    monthly_aggregate: str = "mean",
) -> ImportMappingProposalResponse:
    file_bytes = await file.read()
    if not file_bytes:
        raise ValueError("Uploaded file is empty.")

    file_name = file.filename or "uploaded-file"
    lower = file_name.lower()

    sheet_arg: str | int | None
    if lower.endswith(".csv"):
        sheet_arg = None
    else:
        sheet_arg = sheet_name.strip() if sheet_name.strip() else 0

    if monthly_aggregate not in ("mean", "last", "sum_as_monthly"):
        monthly_aggregate = "mean"

    df, resolved_header_1based = read_tabular_dataframe(
        file_name,
        file_bytes,
        sheet_name=sheet_arg,
        header_row_1based=header_row_1based,
        skip_rows_before_header=max(0, skip_rows_before_header),
    )

    unpivot_applied = False
    if unpivot_month_columns:
        before_cols = len(df.columns)
        df = collapse_wide_month_columns(df, aggregate=monthly_aggregate)  # type: ignore[arg-type]
        unpivot_applied = before_cols != len(df.columns)

    df = df.dropna(how="all")
    source_columns = [str(column) for column in df.columns.tolist()]
    sample_rows = _to_json_safe_records(df, limit=2)

    proposals, guessed_by_model, warning = _guess_mapping_with_gpt(source_columns, sample_rows)

    parse_options: dict[str, object] = {
        "sheet_name": sheet_name.strip() or None,
        "header_row_1based": resolved_header_1based,
        "header_row_requested": header_row_1based,
        "header_auto": header_row_1based < 1,
        "skip_rows_before_header": skip_rows_before_header,
        "unpivot_month_columns": unpivot_month_columns,
        "unpivot_applied": unpivot_applied,
        "monthly_aggregate": monthly_aggregate,
    }

    import_session = ImportSession(
        owner_user_id=user_id,
        original_file_name=file_name,
        file_type="xlsx" if lower.endswith((".xlsx", ".xls")) else "csv",
        status=ImportStatus.mapped,
        total_rows=int(len(df.index)),
        llm_model=guessed_by_model,
        llm_prompt_version=PROMPT_VERSION,
        storage_path=json.dumps(
            {
                "source_columns": source_columns,
                "sample_rows": sample_rows,
                "all_rows": _to_json_safe_records(df),
                "parse_options": parse_options,
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
        parse_options=parse_options,
    )


@router.get("/templates", response_model=list[ImportTemplatePreset])
async def list_import_templates(_: UserContext = Depends(ensure_profile)) -> list[ImportTemplatePreset]:
    return [ImportTemplatePreset.model_validate(t) for t in IMPORT_TEMPLATE_PRESETS]


@router.post("/inspect", response_model=ImportInspectResponse)
async def inspect_spreadsheet(
    file: UploadFile = File(...),
    _: UserContext = Depends(ensure_profile),
) -> ImportInspectResponse:
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")
    file_name = file.filename or "uploaded-file"
    lower = file_name.lower()
    if lower.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(file_bytes), header=None, nrows=500)
        sheets = [ImportInspectSheet(name="(CSV)", row_count=int(len(df.index)), column_count=int(len(df.columns)))]
    elif lower.endswith((".xlsx", ".xls")):
        raw = list_excel_sheet_info(file_bytes, file_name)
        sheets = [ImportInspectSheet(name=s["name"], row_count=s["row_count"], column_count=s["column_count"]) for s in raw]
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Allowed: .csv, .xlsx, .xls",
        )
    return ImportInspectResponse(file_name=file_name, sheets=sheets)


def _form_bool(value: str) -> bool:
    return str(value).strip().lower() in ("1", "true", "yes", "on")


@router.post("/guess-mapping", response_model=ImportMappingProposalResponse)
async def guess_mapping(
    file: UploadFile = File(...),
    sheet_name: str = Form(""),
    header_row_1based: int = Form(0),
    skip_rows_before_header: int = Form(0),
    unpivot_month_columns: str = Form("false"),
    monthly_aggregate: str = Form("mean"),
    user: UserContext = Depends(ensure_profile),
    db: AsyncSession = Depends(get_db),
) -> ImportMappingProposalResponse:
    try:
        return await generate_mapping_proposal(
            db=db,
            user_id=user.user_id,
            file=file,
            sheet_name=sheet_name,
            header_row_1based=header_row_1based,
            skip_rows_before_header=skip_rows_before_header,
            unpivot_month_columns=_form_bool(unpivot_month_columns),
            monthly_aggregate=monthly_aggregate,
        )
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
