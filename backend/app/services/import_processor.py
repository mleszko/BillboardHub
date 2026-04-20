from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import BillboardType, Contract, ImportColumnMapping, ImportRow, ImportRowStatus, ImportSession, ImportStatus
from app.schemas.imports import ImportExecuteResponse, ImportMappingConfirmationRequest
from app.services.import_guesser import parse_date, parse_decimal


def normalize_value(target_field_name: str, value: Any) -> Any:
    date_fields = {"start_date", "expiry_date"}
    decimal_fields = {
        "latitude",
        "longitude",
        "monthly_rent_net",
        "monthly_rent_gross",
        "total_contract_value_net",
        "vat_rate",
    }

    if target_field_name in date_fields:
        return parse_date(value)
    if target_field_name in decimal_fields:
        return parse_decimal(value)
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return value


def _to_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    return parse_date(value)


def _to_decimal(value: Any) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except Exception:  # noqa: BLE001
        return None


def _coerce_billboard_type(raw: Any) -> BillboardType:
    if raw is None or raw == "":
        return BillboardType.other
    if isinstance(raw, BillboardType):
        return raw
    s = str(raw).strip().lower().replace(" ", "_").replace("-", "_")
    aliases = {
        "led": BillboardType.led,
        "citylight": BillboardType.citylight,
        "city_light": BillboardType.citylight,
        "backlight": BillboardType.backlight,
        "backlit": BillboardType.backlight,
        "classic": BillboardType.classic,
        "inny": BillboardType.other,
        "other": BillboardType.other,
    }
    if s in aliases:
        return aliases[s]
    try:
        return BillboardType(s)
    except ValueError:
        return BillboardType.other


def _to_json_safe(value: Any) -> Any:
    return json.loads(json.dumps(value, default=str))


async def confirm_mapping_and_import(
    db: AsyncSession,
    payload: ImportMappingConfirmationRequest,
) -> ImportExecuteResponse:
    session = await db.get(ImportSession, payload.session_id)
    if session is None or session.owner_user_id != payload.owner_user_id:
        raise ValueError("Import session not found.")

    existing_mappings = (
        await db.execute(
            select(ImportColumnMapping).where(
                ImportColumnMapping.import_session_id == payload.session_id,
                ImportColumnMapping.owner_user_id == payload.owner_user_id,
            )
        )
    ).scalars().all()
    by_source = {m.source_column_name: m for m in existing_mappings}

    for proposed in payload.mapping:
        mapped = by_source.get(proposed.source_column_name)
        if not mapped:
            continue
        mapped.target_field_name = proposed.target_field_name
        mapped.confirmed_by_user = proposed.confirmed_by_user
        mapped.user_override = proposed.user_override
        mapped.transform_hint = proposed.transform_hint

    session.status = ImportStatus.confirmed
    required_targets = {"advertiser_name", "expiry_date"}
    selected_targets = {item.target_field_name for item in payload.mapping if item.target_field_name}
    missing_targets = required_targets.difference(selected_targets)
    if missing_targets:
        raise ValueError(f"Missing required mapped fields: {', '.join(sorted(missing_targets))}")

    await db.execute(delete(ImportRow).where(ImportRow.import_session_id == payload.session_id))

    mapped_columns = {
        item.source_column_name: item.target_field_name
        for item in payload.mapping
        if item.target_field_name and item.confirmed_by_user
    }
    transform_hints = {item.source_column_name: item.transform_hint for item in payload.mapping if item.transform_hint}

    try:
        storage_payload = json.loads(session.storage_path or "{}")
    except json.JSONDecodeError as exc:
        raise ValueError("Stored import session payload is invalid JSON.") from exc
    source_rows = storage_payload.get("all_rows")
    if not isinstance(source_rows, list):
        raise ValueError("Import session has no parsed source rows. Re-upload the file and try again.")

    contracts_to_create: list[Contract] = []
    invalid_preview: list[dict[str, Any]] = []
    valid_rows = 0
    invalid_rows = 0

    for row_index, raw_row in enumerate(source_rows, start=1):
        if not isinstance(raw_row, dict):
            invalid_rows += 1
            if len(invalid_preview) < 10:
                invalid_preview.append({"row": row_index, "errors": [{"field": "row", "reason": "Invalid row payload"}]})
            continue
        normalized_payload: dict[str, Any] = {}
        validation_errors: list[dict[str, str]] = []

        for source_column, target_field in mapped_columns.items():
            raw_value = raw_row.get(source_column)
            normalized_value = normalize_value(target_field, raw_value)
            if target_field in {"start_date", "expiry_date"} and transform_hints.get(source_column):
                normalized_value = parse_date(raw_value)
            normalized_payload[target_field] = normalized_value

        if not normalized_payload.get("advertiser_name"):
            validation_errors.append({"field": "advertiser_name", "reason": "Required field missing"})
        if not normalized_payload.get("expiry_date"):
            validation_errors.append({"field": "expiry_date", "reason": "Required field missing or invalid date"})

        row_status = ImportRowStatus.invalid if validation_errors else ImportRowStatus.valid
        import_row = ImportRow(
            import_session_id=session.id,
            owner_user_id=session.owner_user_id,
            source_row_number=row_index,
            raw_payload=_to_json_safe(raw_row),
            normalized_payload=_to_json_safe(normalized_payload),
            validation_errors=_to_json_safe({"errors": validation_errors}) if validation_errors else None,
            status=row_status,
        )
        db.add(import_row)

        if validation_errors:
            invalid_rows += 1
            if len(invalid_preview) < 10:
                invalid_preview.append({"row": row_index, "errors": validation_errors})
            continue

        valid_rows += 1
        contracts_to_create.append(
            Contract(
                owner_user_id=session.owner_user_id,
                source_file_name=session.original_file_name,
                source_row_number=row_index,
                contract_number=normalized_payload.get("contract_number"),
                advertiser_name=normalized_payload.get("advertiser_name"),
                property_owner_name=normalized_payload.get("property_owner_name"),
                billboard_code=normalized_payload.get("billboard_code"),
                billboard_type=_coerce_billboard_type(normalized_payload.get("billboard_type")),
                surface_size=normalized_payload.get("surface_size"),
                location_address=normalized_payload.get("location_address"),
                city=normalized_payload.get("city"),
                latitude=_to_decimal(normalized_payload.get("latitude")),
                longitude=_to_decimal(normalized_payload.get("longitude")),
                start_date=normalized_payload.get("start_date"),
                expiry_date=_to_date(normalized_payload.get("expiry_date")),
                monthly_rent_net=_to_decimal(normalized_payload.get("monthly_rent_net")),
                monthly_rent_gross=_to_decimal(normalized_payload.get("monthly_rent_gross")),
                total_contract_value_net=_to_decimal(normalized_payload.get("total_contract_value_net")),
                currency=normalized_payload.get("currency") or "PLN",
                vat_rate=_to_decimal(normalized_payload.get("vat_rate")),
                contact_person=normalized_payload.get("contact_person"),
                contact_phone=normalized_payload.get("contact_phone"),
                contact_email=normalized_payload.get("contact_email"),
                notes=normalized_payload.get("notes"),
            )
        )

    for contract in contracts_to_create:
        db.add(contract)

    session.total_rows = len(source_rows)
    session.valid_rows = valid_rows
    session.invalid_rows = invalid_rows
    session.imported_rows = len(contracts_to_create)
    session.status = ImportStatus.completed if invalid_rows == 0 else ImportStatus.failed
    session.completed_at = datetime.utcnow()

    await db.commit()

    return ImportExecuteResponse(
        session_id=session.id,
        status=session.status.value,
        total_rows=session.total_rows,
        valid_rows=session.valid_rows,
        invalid_rows=session.invalid_rows,
        imported_rows=session.imported_rows,
        errors_preview=invalid_preview,
    )
