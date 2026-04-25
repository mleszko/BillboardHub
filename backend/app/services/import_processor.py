from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import PLACEHOLDER_CONTRACT_EXPIRY
from app.core.config import get_settings
from app.models.models import BillboardType, Contract, ImportColumnMapping, ImportRow, ImportRowStatus, ImportSession, ImportStatus
from app.schemas.imports import ImportExecuteResponse, ImportMappingConfirmationRequest
from app.services.custom_columns import compute_active_columns_for_contracts
from app.services.import_excel import is_noise_import_row, is_probable_summary_raw_row
from app.services.import_guesser import parse_date, parse_decimal
from app.services.llm_gateway import chat_json_with_fallback

MISSING_ADVERTISER_PLACEHOLDER = "DO_UZUPELNIENIA"
LP_COLUMN_TOKENS = frozenset({"l.p", "lp", "l_p", "l p"})


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
    text_fields = {
        "contract_number",
        "advertiser_name",
        "property_owner_name",
        "billboard_code",
        "billboard_type",
        "surface_size",
        "location_address",
        "city",
        "currency",
        "contact_person",
        "contact_phone",
        "contact_email",
        "notes",
    }

    if target_field_name in date_fields:
        return parse_date(value)
    if target_field_name in decimal_fields:
        return parse_decimal(value)
    if target_field_name in text_fields:
        if value is None:
            return None
        if isinstance(value, float):
            if value != value:
                return None
            if value.is_integer():
                as_str = str(int(value))
            else:
                as_str = str(value)
            stripped = as_str.strip()
            return stripped or None
        as_str = str(value).strip()
        return as_str or None
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


def _clean_party_field(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float) and value != value:
        return None
    if isinstance(value, str):
        s = value.strip()
        if not s or s in {"?", "-", "—", "..", "…"}:
            return None
        return s
    return value


def _is_lp_like_column(source_column_name: str) -> bool:
    normalized = (
        source_column_name.strip().lower().replace(".", "").replace("_", " ").replace("-", " ")
    )
    compact = normalized.replace(" ", "")
    return normalized in LP_COLUMN_TOKENS or compact in LP_COLUMN_TOKENS


def _sanitize_mapping_dict(mapping: dict[str, str]) -> dict[str, str]:
    sanitized: dict[str, str] = {}
    for source_column_name, target_field_name in mapping.items():
        if target_field_name == "contract_number" and _is_lp_like_column(source_column_name):
            continue
        sanitized[source_column_name] = target_field_name
    return sanitized


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


def _raw_row_excerpt(raw_row: dict[str, Any], max_items: int = 4) -> dict[str, Any]:
    excerpt: dict[str, Any] = {}
    for key, value in raw_row.items():
        if value is None:
            continue
        s = str(value).strip()
        if not s:
            continue
        excerpt[str(key)] = s
        if len(excerpt) >= max_items:
            break
    return excerpt


def _norm_key(value: Any) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    return s.lower() if s else None


def _dedupe_key(normalized_payload: dict[str, Any]) -> tuple[str, str] | None:
    contract_number = _norm_key(normalized_payload.get("contract_number"))
    if contract_number:
        return ("contract_number", contract_number)
    billboard_code = _norm_key(normalized_payload.get("billboard_code"))
    if billboard_code:
        return ("billboard_code", billboard_code)
    advertiser = _norm_key(normalized_payload.get("advertiser_name"))
    city = _norm_key(normalized_payload.get("city"))
    address = _norm_key(normalized_payload.get("location_address"))
    expiry = _norm_key(normalized_payload.get("expiry_date"))
    if advertiser and city and address and expiry:
        return ("composite_v1", f"{advertiser}|{city}|{address}|{expiry}")
    return None


def _attempt_llm_row_repair(
    *,
    raw_row: dict[str, Any],
    normalized_payload: dict[str, Any],
) -> dict[str, Any] | None:
    settings = get_settings()
    if not settings.import_llm_row_repair:
        return None
    system_prompt = (
        "You repair a single import row. Return strict JSON with object key 'patch'. "
        "Allowed patch keys: advertiser_name, expiry_date. "
        "Use null when unsure and never return extra keys."
    )
    user_prompt = json.dumps(
        {
            "raw_row": raw_row,
            "normalized_payload": normalized_payload,
            "required_fields": ["advertiser_name", "expiry_date"],
            "output_schema": {"patch": {"advertiser_name": "string|null", "expiry_date": "string|null"}},
        },
        ensure_ascii=False,
    )
    try:
        payload, _ = chat_json_with_fallback(
            use_case="import",
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.0,
        )
    except Exception:  # noqa: BLE001
        return None
    patch = payload.get("patch")
    if not isinstance(patch, dict):
        return None
    repaired: dict[str, Any] = {}
    if "advertiser_name" in patch:
        repaired["advertiser_name"] = _clean_party_field(patch.get("advertiser_name"))
    if "expiry_date" in patch:
        repaired["expiry_date"] = parse_date(patch.get("expiry_date"))
    return repaired


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

    await db.execute(delete(ImportRow).where(ImportRow.import_session_id == payload.session_id))

    mapped_columns = _sanitize_mapping_dict(
        {
            item.source_column_name: item.target_field_name
            for item in payload.mapping
            if item.target_field_name and item.confirmed_by_user
        }
    )
    transform_hints = {item.source_column_name: item.transform_hint for item in payload.mapping if item.transform_hint}
    sheet_mapped_columns: dict[str, dict[str, str]] = {}
    sheet_transform_hints: dict[str, dict[str, str]] = {}
    for override in payload.sheet_overrides:
        normalized_name = override.sheet_name.strip()
        if not normalized_name:
            continue
        sheet_mapped_columns[normalized_name] = _sanitize_mapping_dict(
            {
                item.source_column_name: item.target_field_name
                for item in override.mapping
                if item.target_field_name and item.confirmed_by_user
            }
        )
        sheet_transform_hints[normalized_name] = {
            item.source_column_name: item.transform_hint for item in override.mapping if item.transform_hint
        }

    try:
        storage_payload = json.loads(session.storage_path or "{}")
    except json.JSONDecodeError as exc:
        raise ValueError("Stored import session payload is invalid JSON.") from exc
    source_rows = storage_payload.get("all_rows")
    if not isinstance(source_rows, list):
        raise ValueError("Import session has no parsed source rows. Re-upload the file and try again.")

    contracts_to_create: list[Contract] = []
    contracts_to_update: list[Contract] = []
    invalid_preview: list[dict[str, Any]] = []
    valid_rows = 0
    invalid_rows = 0
    llm_repairs_used = 0
    llm_repair_limit = 25
    existing_contracts = (
        await db.execute(select(Contract).where(Contract.owner_user_id == payload.owner_user_id))
    ).scalars().all()
    existing_by_key: dict[tuple[str, str], Contract] = {}
    for contract in existing_contracts:
        contract_number_key = _norm_key(contract.contract_number)
        if contract_number_key:
            existing_by_key[("contract_number", contract_number_key)] = contract
        billboard_code_key = _norm_key(contract.billboard_code)
        if billboard_code_key:
            existing_by_key[("billboard_code", billboard_code_key)] = contract
        advertiser_key = _norm_key(contract.advertiser_name)
        city_key = _norm_key(contract.city)
        address_key = _norm_key(contract.location_address)
        expiry_key = _norm_key(contract.expiry_date.isoformat() if contract.expiry_date else None)
        if advertiser_key and city_key and address_key and expiry_key:
            existing_by_key[("composite_v1", f"{advertiser_key}|{city_key}|{address_key}|{expiry_key}")] = contract

    for row_index, raw_row in enumerate(source_rows, start=1):
        if not isinstance(raw_row, dict):
            invalid_rows += 1
            if len(invalid_preview) < 10:
                invalid_preview.append({"row": row_index, "errors": [{"field": "row", "reason": "Invalid row payload"}]})
            continue
        normalized_payload: dict[str, Any] = {}
        validation_errors: list[dict[str, str]] = []
        row_source_sheet = str(raw_row.get("__source_sheet") or "").strip()
        row_mapping = dict(mapped_columns)
        row_transform_hints = dict(transform_hints)
        if row_source_sheet and row_source_sheet in sheet_mapped_columns:
            row_mapping.update(sheet_mapped_columns[row_source_sheet])
            row_transform_hints.update(sheet_transform_hints.get(row_source_sheet, {}))

        for source_column, target_field in row_mapping.items():
            raw_value = raw_row.get(source_column)
            normalized_value = normalize_value(target_field, raw_value)
            if target_field in {"start_date", "expiry_date"} and row_transform_hints.get(source_column):
                normalized_value = parse_date(raw_value)
            normalized_payload[target_field] = normalized_value

        normalized_payload["advertiser_name"] = _clean_party_field(normalized_payload.get("advertiser_name"))
        normalized_payload["property_owner_name"] = _clean_party_field(normalized_payload.get("property_owner_name"))
        advertiser_fallback_applied = False

        if not normalized_payload.get("advertiser_name") and normalized_payload.get("property_owner_name"):
            normalized_payload["advertiser_name"] = normalized_payload["property_owner_name"]
            advertiser_fallback_applied = True
        if not normalized_payload.get("advertiser_name"):
            normalized_payload["advertiser_name"] = MISSING_ADVERTISER_PLACEHOLDER
            advertiser_fallback_applied = True

        if not normalized_payload.get("expiry_date"):
            normalized_payload["expiry_date"] = PLACEHOLDER_CONTRACT_EXPIRY

        if is_probable_summary_raw_row(raw_row):
            validation_errors.append(
                {"field": "row", "reason": "Wiersz pominięty (RAZEM/SUMA lub pusty)."}
            )
        if not normalized_payload.get("expiry_date"):
            validation_errors.append({"field": "expiry_date", "reason": "Required field missing or invalid date"})
        if is_noise_import_row(normalized_payload):
            validation_errors.append(
                {"field": "row", "reason": "Wiersz pominięty (suma częściowa, nagłówek grupy lub pusty klient)."}
            )

        needs_repair = any(err["field"] in {"advertiser_name", "expiry_date"} for err in validation_errors)
        if needs_repair and llm_repairs_used < llm_repair_limit:
            repaired = _attempt_llm_row_repair(raw_row=raw_row, normalized_payload=normalized_payload)
            if repaired:
                llm_repairs_used += 1
                if repaired.get("advertiser_name"):
                    normalized_payload["advertiser_name"] = repaired["advertiser_name"]
                if repaired.get("expiry_date"):
                    normalized_payload["expiry_date"] = repaired["expiry_date"]
                validation_errors = []
                if not normalized_payload.get("expiry_date"):
                    validation_errors.append({"field": "expiry_date", "reason": "Required field missing or invalid date"})
                if is_noise_import_row(normalized_payload):
                    validation_errors.append(
                        {"field": "row", "reason": "Wiersz pominięty (suma częściowa, nagłówek grupy lub pusty klient)."}
                    )

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
                invalid_preview.append(
                    {"row": row_index, "errors": validation_errors, "raw_excerpt": _raw_row_excerpt(raw_row)}
                )
            continue

        valid_rows += 1
        key = _dedupe_key(normalized_payload)
        existing_contract = existing_by_key.get(key) if key else None

        if existing_contract is not None:
            existing_contract.source_file_name = session.original_file_name
            existing_contract.source_row_number = row_index
            existing_contract.contract_number = normalized_payload.get("contract_number")
            existing_contract.advertiser_name = normalized_payload.get("advertiser_name")
            existing_contract.property_owner_name = normalized_payload.get("property_owner_name")
            existing_contract.billboard_code = normalized_payload.get("billboard_code")
            existing_contract.billboard_type = _coerce_billboard_type(normalized_payload.get("billboard_type"))
            existing_contract.surface_size = normalized_payload.get("surface_size")
            existing_contract.location_address = normalized_payload.get("location_address")
            existing_contract.city = normalized_payload.get("city")
            existing_contract.latitude = _to_decimal(normalized_payload.get("latitude"))
            existing_contract.longitude = _to_decimal(normalized_payload.get("longitude"))
            existing_contract.start_date = normalized_payload.get("start_date")
            existing_contract.expiry_date = _to_date(normalized_payload.get("expiry_date"))
            existing_contract.monthly_rent_net = _to_decimal(normalized_payload.get("monthly_rent_net"))
            existing_contract.monthly_rent_gross = _to_decimal(normalized_payload.get("monthly_rent_gross"))
            existing_contract.total_contract_value_net = _to_decimal(normalized_payload.get("total_contract_value_net"))
            existing_contract.currency = normalized_payload.get("currency") or "PLN"
            existing_contract.vat_rate = _to_decimal(normalized_payload.get("vat_rate"))
            existing_contract.contact_person = normalized_payload.get("contact_person")
            existing_contract.contact_phone = normalized_payload.get("contact_phone")
            existing_contract.contact_email = normalized_payload.get("contact_email")
            existing_contract.notes = normalized_payload.get("notes")
            contracts_to_update.append(existing_contract)
            refreshed_key = _dedupe_key(normalized_payload)
            if refreshed_key:
                existing_by_key[refreshed_key] = existing_contract
            if advertiser_fallback_applied and len(invalid_preview) < 10:
                invalid_preview.append(
                    {
                        "row": row_index,
                        "errors": [
                            {
                                "field": "advertiser_name",
                                "reason": "Missing mapping/value filled automatically.",
                            }
                        ],
                        "raw_excerpt": _raw_row_excerpt(raw_row),
                    }
                )
        else:
            contract = Contract(
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
            contracts_to_create.append(contract)
            created_key = _dedupe_key(normalized_payload)
            if created_key:
                existing_by_key[created_key] = contract
            if advertiser_fallback_applied and len(invalid_preview) < 10:
                invalid_preview.append(
                    {
                        "row": row_index,
                        "errors": [
                            {
                                "field": "advertiser_name",
                                "reason": "Missing mapping/value filled automatically.",
                            }
                        ],
                        "raw_excerpt": _raw_row_excerpt(raw_row),
                    }
                )

    for contract in contracts_to_create:
        db.add(contract)

    session.total_rows = len(source_rows)
    session.valid_rows = valid_rows
    session.invalid_rows = invalid_rows
    session.imported_rows = len(contracts_to_create) + len(contracts_to_update)
    session.status = ImportStatus.failed if session.imported_rows == 0 else ImportStatus.completed
    session.completed_at = datetime.utcnow()

    await db.flush()
    if contracts_to_create:
        await compute_active_columns_for_contracts(
            db=db,
            user_id=session.owner_user_id,
            contracts=contracts_to_create,
        )

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
