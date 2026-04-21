from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import (
    Contract,
    ContractCustomColumn,
    ContractCustomValue,
    CustomColumnOutputType,
    CustomColumnValueStatus,
)
from app.services.llm_gateway import chat_json_with_fallback


def _output_type_from_string(value: str) -> CustomColumnOutputType:
    normalized = value.strip().lower()
    if normalized == CustomColumnOutputType.number.value:
        return CustomColumnOutputType.number
    return CustomColumnOutputType.text


def _contract_context(contract: Contract) -> dict[str, Any]:
    return {
        "contract_number": contract.contract_number,
        "advertiser_name": contract.advertiser_name,
        "property_owner_name": contract.property_owner_name,
        "billboard_code": contract.billboard_code,
        "billboard_type": contract.billboard_type.value if contract.billboard_type else None,
        "location_address": contract.location_address,
        "city": contract.city,
        "latitude": float(contract.latitude) if contract.latitude is not None else None,
        "longitude": float(contract.longitude) if contract.longitude is not None else None,
        "start_date": contract.start_date.isoformat() if contract.start_date else None,
        "expiry_date": contract.expiry_date.isoformat() if contract.expiry_date else None,
        "monthly_rent_net": float(contract.monthly_rent_net) if contract.monthly_rent_net is not None else None,
        "monthly_rent_gross": float(contract.monthly_rent_gross) if contract.monthly_rent_gross is not None else None,
        "currency": contract.currency,
        "notes": contract.notes,
    }


def _build_prompts(column: ContractCustomColumn, contract: Contract) -> tuple[str, str]:
    system_prompt = (
        "You evaluate billboard contract records and return strict JSON. "
        "Return exactly one object with keys: value, confidence, source_note. "
        "confidence must be between 0 and 1."
    )
    user_prompt = json.dumps(
        {
            "task": "Compute custom column value for one billboard contract.",
            "column": {
                "name": column.name,
                "output_type": column.output_type.value,
                "prompt_template": column.prompt_template,
            },
            "contract": _contract_context(contract),
            "output_schema": {"value": "string|number|null", "confidence": "number", "source_note": "string|null"},
        },
        ensure_ascii=True,
    )
    return system_prompt, user_prompt


def _normalize_number(value: Any) -> Decimal:
    if isinstance(value, Decimal):
        return value
    if isinstance(value, (int, float)):
        return Decimal(str(value))
    if isinstance(value, str):
        cleaned = value.strip().replace(",", ".")
        if not cleaned:
            raise ValueError("Empty number")
        return Decimal(cleaned)
    raise ValueError("Unsupported number value type")


def _upsert_value_shell(
    existing: ContractCustomValue | None,
    *,
    owner_user_id: str,
    contract_id: str,
    column_id: str,
) -> ContractCustomValue:
    if existing is not None:
        return existing
    return ContractCustomValue(
        owner_user_id=owner_user_id,
        contract_id=contract_id,
        column_id=column_id,
        status=CustomColumnValueStatus.pending,
    )


async def compute_custom_column_for_contract(
    *,
    db: AsyncSession,
    owner_user_id: str,
    contract: Contract,
    column: ContractCustomColumn,
) -> ContractCustomValue:
    existing = (
        await db.execute(
            select(ContractCustomValue).where(
                ContractCustomValue.owner_user_id == owner_user_id,
                ContractCustomValue.contract_id == contract.id,
                ContractCustomValue.column_id == column.id,
            )
        )
    ).scalar_one_or_none()
    value_row = _upsert_value_shell(
        existing,
        owner_user_id=owner_user_id,
        contract_id=contract.id,
        column_id=column.id,
    )
    if existing is None:
        db.add(value_row)

    try:
        system_prompt, user_prompt = _build_prompts(column, contract)
        parsed, used_model = chat_json_with_fallback(
            use_case="hubert",
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.1,
        )
        raw_value = parsed.get("value")
        confidence = parsed.get("confidence")
        source_note = parsed.get("source_note")

        value_row.value_json = {
            "confidence": confidence,
            "source_note": source_note,
            "model": used_model,
        }
        value_row.value_text = None
        value_row.value_number = None
        if column.output_type == CustomColumnOutputType.number:
            value_row.value_number = _normalize_number(raw_value)
        else:
            value_row.value_text = None if raw_value is None else str(raw_value)
        value_row.status = CustomColumnValueStatus.computed
        value_row.error_message = None
    except Exception as exc:  # noqa: BLE001
        value_row.status = CustomColumnValueStatus.failed
        value_row.error_message = str(exc)
        value_row.value_text = None
        value_row.value_number = None
    value_row.computed_at = datetime.utcnow()
    return value_row


async def compute_custom_columns_for_contracts(
    *,
    db: AsyncSession,
    owner_user_id: str,
    contracts: list[Contract],
    columns: list[ContractCustomColumn],
) -> None:
    for contract in contracts:
        for column in columns:
            if not column.is_active:
                continue
            await compute_custom_column_for_contract(
                db=db,
                owner_user_id=owner_user_id,
                contract=contract,
                column=column,
            )


async def list_custom_columns(
    *,
    db: AsyncSession,
    owner_user_id: str,
) -> list[ContractCustomColumn]:
    result = await db.execute(
        select(ContractCustomColumn)
        .where(ContractCustomColumn.owner_user_id == owner_user_id)
        .order_by(ContractCustomColumn.created_at.asc())
    )
    return result.scalars().all()


async def create_custom_column(
    *,
    db: AsyncSession,
    owner_user_id: str,
    name: str,
    prompt_template: str,
    output_type: str,
) -> ContractCustomColumn:
    column = ContractCustomColumn(
        owner_user_id=owner_user_id,
        name=name.strip(),
        prompt_template=prompt_template.strip(),
        output_type=_output_type_from_string(output_type),
        is_active=True,
    )
    db.add(column)
    await db.flush()
    return column


async def recompute_custom_values_for_column(
    *,
    db: AsyncSession,
    owner_user_id: str,
    column: ContractCustomColumn,
) -> None:
    contracts_result = await db.execute(
        select(Contract).where(Contract.owner_user_id == owner_user_id).order_by(Contract.expiry_date.asc())
    )
    contracts = contracts_result.scalars().all()
    if not contracts:
        return
    await compute_custom_columns_for_contracts(
        db=db,
        owner_user_id=owner_user_id,
        contracts=contracts,
        columns=[column],
    )


async def compute_active_columns_for_contracts(
    *,
    db: AsyncSession,
    user_id: str,
    contracts: list[Contract],
) -> None:
    if not contracts:
        return
    result = await db.execute(
        select(ContractCustomColumn).where(
            ContractCustomColumn.owner_user_id == user_id,
            ContractCustomColumn.is_active.is_(True),
        )
    )
    columns = result.scalars().all()
    if not columns:
        return
    await compute_custom_columns_for_contracts(
        db=db,
        owner_user_id=user_id,
        contracts=contracts,
        columns=columns,
    )
