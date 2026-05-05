from datetime import date, datetime, UTC
from decimal import Decimal
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from supabase import create_client

from app.constants import PLACEHOLDER_CONTRACT_EXPIRY
from app.core.auth import UserContext, ensure_profile
from app.core.config import get_settings
from app.core.database import get_db
from app.models.models import Contract, ContractCustomColumn, ContractCustomValue, ContractStatus
from app.schemas.contracts_write import ContractCreateBody, ContractUpdateBody
from app.schemas.imports import ContractCustomColumnItem, ContractCustomValueItem, ContractsListResponse
from app.services.import_processor import _coerce_billboard_type

router = APIRouter(prefix="/contracts", tags=["contracts"])


def _decimal_to_float(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _contract_to_dict(
    contract: Contract,
    *,
    photo_url_override: str | None = None,
) -> dict[str, object | None]:
    return {
        "id": contract.id,
        "contract_number": contract.contract_number,
        "billboard_code": contract.billboard_code,
        "asset_name": contract.asset_name,
        "billboard_type": contract.billboard_type.value if contract.billboard_type else None,
        "advertiser_name": contract.advertiser_name,
        "investment_name": contract.investment_name,
        "property_owner_name": contract.property_owner_name,
        "city": contract.city,
        "location_address": contract.location_address,
        "latitude": float(contract.latitude) if contract.latitude is not None else None,
        "longitude": float(contract.longitude) if contract.longitude is not None else None,
        "gps_coordinates_raw": contract.gps_coordinates_raw,
        "surface_size": contract.surface_size,
        "start_date": contract.start_date.isoformat() if contract.start_date else None,
        "expiry_date": contract.expiry_date.isoformat(),
        "expiry_unknown": contract.expiry_date == PLACEHOLDER_CONTRACT_EXPIRY,
        "contract_status": contract.contract_status.value,
        "monthly_rent_net": _decimal_to_float(contract.monthly_rent_net),
        "total_contract_value_net": _decimal_to_float(contract.total_contract_value_net),
        "contact_person": contract.contact_person,
        "contact_phone": contract.contact_phone,
        "contact_email": contract.contact_email,
        "notes": contract.notes,
        "photo_url": photo_url_override if photo_url_override is not None else contract.photo_url,
    }


def _resolve_create_expiry(body: ContractCreateBody) -> date:
    if body.expiry_unknown:
        return PLACEHOLDER_CONTRACT_EXPIRY
    if body.expiry_date is not None:
        return body.expiry_date
    return PLACEHOLDER_CONTRACT_EXPIRY


def _status_for_expiry(expiry: date) -> ContractStatus:
    if expiry == PLACEHOLDER_CONTRACT_EXPIRY:
        return ContractStatus.active
    if expiry < date.today():
        return ContractStatus.expired
    return ContractStatus.active


def _supabase_storage_client():
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Supabase storage is not configured on backend. "
                "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY "
                "(or compatible aliases SUPABASE_SERVICE_KEY / SUPABASE_KEY)."
            ),
        )
    return create_client(settings.supabase_url, settings.supabase_service_role_key).storage


def _extract_signed_url(value: object) -> str | None:
    if isinstance(value, str):
        return value or None
    if isinstance(value, dict):
        raw = value.get("signedURL") or value.get("signedUrl")
        return str(raw) if raw else None
    raw = getattr(value, "signedURL", None) or getattr(value, "signedUrl", None)
    return str(raw) if raw else None


def _create_photo_url_for_contract(contract: Contract, *, signed_url_ttl_seconds: int = 86_400) -> str | None:
    if not contract.photo_path:
        return contract.photo_url

    settings = get_settings()
    try:
        storage = _supabase_storage_client()
        signed = storage.from_(settings.contract_photo_bucket).create_signed_url(
            contract.photo_path, signed_url_ttl_seconds
        )
    except Exception:  # noqa: BLE001
        return contract.photo_url
    return _extract_signed_url(signed) or contract.photo_url


@router.get("", response_model=ContractsListResponse)
async def list_contracts(
    user: UserContext = Depends(ensure_profile),
    db: AsyncSession = Depends(get_db),
) -> ContractsListResponse:
    contracts_result = await db.execute(
        select(Contract)
        .where(Contract.owner_user_id == user.user_id)
        .order_by(Contract.expiry_date.asc())
        .limit(500)
    )
    contracts = contracts_result.scalars().all()

    columns_result = await db.execute(
        select(ContractCustomColumn)
        .where(
            ContractCustomColumn.owner_user_id == user.user_id,
            ContractCustomColumn.is_active.is_(True),
        )
        .order_by(ContractCustomColumn.created_at.asc())
    )
    custom_columns = columns_result.scalars().all()

    values_result = await db.execute(
        select(ContractCustomValue).where(
            ContractCustomValue.owner_user_id == user.user_id,
        )
    )
    values = values_result.scalars().all()
    values_by_contract: dict[str, dict[str, ContractCustomValue]] = {}
    for value in values:
        values_by_contract.setdefault(value.contract_id, {})[value.column_id] = value

    photo_url_by_contract: dict[str, str | None] = {
        contract.id: _create_photo_url_for_contract(contract) for contract in contracts
    }

    return ContractsListResponse(
        custom_columns=[
            ContractCustomColumnItem(
                id=column.id,
                name=column.name,
                prompt_template=column.prompt_template,
                output_type=column.output_type.value,
                is_active=column.is_active,
                created_at=column.created_at.isoformat(),
                updated_at=column.updated_at.isoformat(),
            )
            for column in custom_columns
        ],
        items=[
            {
                **_contract_to_dict(contract, photo_url_override=photo_url_by_contract.get(contract.id)),
                "custom_values": {
                    column_id: ContractCustomValueItem(
                        status=stored_value.status.value,
                        value_text=stored_value.value_text,
                        value_number=_decimal_to_float(stored_value.value_number),
                        error_message=stored_value.error_message,
                        computed_at=stored_value.computed_at.isoformat() if stored_value.computed_at else None,
                    )
                    for column_id, stored_value in values_by_contract.get(contract.id, {}).items()
                },
            }
            for contract in contracts
        ],
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_contract(
    body: ContractCreateBody,
    user: UserContext = Depends(ensure_profile),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object | None]:
    expiry = _resolve_create_expiry(body)
    contract = Contract(
        owner_user_id=user.user_id,
        advertiser_name=body.advertiser_name.strip(),
        contract_number=body.contract_number.strip() if body.contract_number else None,
        billboard_code=body.billboard_code.strip() if body.billboard_code else None,
        asset_name=body.asset_name.strip() if body.asset_name else None,
        billboard_type=_coerce_billboard_type(body.billboard_type),
        investment_name=body.investment_name.strip() if body.investment_name else None,
        city=body.city.strip() if body.city else None,
        location_address=body.location_address.strip() if body.location_address else None,
        latitude=body.latitude,
        longitude=body.longitude,
        surface_size=body.surface_size.strip() if body.surface_size else None,
        start_date=body.start_date,
        expiry_date=expiry,
        monthly_rent_net=body.monthly_rent_net,
        notes=body.notes.strip() if body.notes else None,
        gps_coordinates_raw=body.gps_coordinates_raw.strip() if body.gps_coordinates_raw else None,
        contract_status=_status_for_expiry(expiry),
    )
    db.add(contract)
    await db.commit()
    await db.refresh(contract)
    return _contract_to_dict(contract)


@router.patch("/{contract_id}")
async def update_contract(
    contract_id: str,
    body: ContractUpdateBody,
    user: UserContext = Depends(ensure_profile),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object | None]:
    result = await db.execute(
        select(Contract).where(
            Contract.id == contract_id,
            Contract.owner_user_id == user.user_id,
        )
    )
    contract = result.scalar_one_or_none()
    if contract is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found.")

    updates = body.model_dump(exclude_unset=True)

    if "advertiser_name" in updates:
        contract.advertiser_name = updates["advertiser_name"].strip()
    if "contract_number" in updates:
        v = updates["contract_number"]
        contract.contract_number = v.strip() if v else None
    if "billboard_code" in updates:
        v = updates["billboard_code"]
        contract.billboard_code = v.strip() if v else None
    if "asset_name" in updates:
        v = updates["asset_name"]
        contract.asset_name = v.strip() if v else None
    if "billboard_type" in updates:
        contract.billboard_type = _coerce_billboard_type(updates["billboard_type"])
    if "investment_name" in updates:
        v = updates["investment_name"]
        contract.investment_name = v.strip() if v else None
    if "city" in updates:
        v = updates["city"]
        contract.city = v.strip() if v else None
    if "location_address" in updates:
        v = updates["location_address"]
        contract.location_address = v.strip() if v else None
    if "latitude" in updates:
        contract.latitude = updates["latitude"]
    if "longitude" in updates:
        contract.longitude = updates["longitude"]
    if "surface_size" in updates:
        v = updates["surface_size"]
        contract.surface_size = v.strip() if v else None
    if "start_date" in updates:
        contract.start_date = updates["start_date"]
    if "monthly_rent_net" in updates:
        contract.monthly_rent_net = updates["monthly_rent_net"]
    if "notes" in updates:
        v = updates["notes"]
        contract.notes = v.strip() if v else None
    if "gps_coordinates_raw" in updates:
        v = updates["gps_coordinates_raw"]
        contract.gps_coordinates_raw = v.strip() if v else None

    if "expiry_date" in updates and updates["expiry_date"] is not None:
        contract.expiry_date = updates["expiry_date"]
    elif updates.get("expiry_unknown") is True:
        contract.expiry_date = PLACEHOLDER_CONTRACT_EXPIRY

    contract.contract_status = _status_for_expiry(contract.expiry_date)

    await db.commit()
    await db.refresh(contract)
    return _contract_to_dict(contract)


@router.delete("/{contract_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contract(
    contract_id: str,
    user: UserContext = Depends(ensure_profile),
    db: AsyncSession = Depends(get_db),
) -> Response:
    result = await db.execute(
        delete(Contract).where(
            Contract.id == contract_id,
            Contract.owner_user_id == user.user_id,
        )
    )
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_contracts(
    user: UserContext = Depends(ensure_profile),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await db.execute(delete(Contract).where(Contract.owner_user_id == user.user_id))
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{contract_id}/photo")
async def upload_contract_photo(
    contract_id: str,
    photo: UploadFile = File(...),
    width: int = Form(...),
    height: int = Form(...),
    user: UserContext = Depends(ensure_profile),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    result = await db.execute(
        select(Contract).where(
            Contract.id == contract_id,
            Contract.owner_user_id == user.user_id,
        )
    )
    contract = result.scalar_one_or_none()
    if contract is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found.")

    settings = get_settings()
    if width <= 0 or height <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid photo dimensions.")
    if width > settings.contract_photo_max_dimension_px or height > settings.contract_photo_max_dimension_px:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Photo dimensions exceed {settings.contract_photo_max_dimension_px}px.",
        )

    content_type = (photo.content_type or "").lower()
    if content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported photo format.")

    raw = await photo.read()
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded photo is empty.")
    if len(raw) > settings.contract_photo_max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Photo exceeds {settings.contract_photo_max_bytes} bytes.",
        )

    ext = Path(photo.filename or "photo.jpg").suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        ext = ".jpg"
    object_path = f"{user.user_id}/{contract.id}/photo-{int(datetime.now(UTC).timestamp())}{ext}"

    storage = _supabase_storage_client()
    if contract.photo_path:
        try:
            storage.from_(settings.contract_photo_bucket).remove([contract.photo_path])
        except Exception:  # noqa: BLE001
            pass
    storage.from_(settings.contract_photo_bucket).upload(
        object_path,
        raw,
        {"content-type": content_type, "upsert": "true"},
    )
    public_url = storage.from_(settings.contract_photo_bucket).get_public_url(object_path)

    contract.photo_path = object_path
    contract.photo_url = public_url
    contract.photo_updated_at = datetime.now(UTC)
    await db.commit()
    return {"photo_url": public_url}


@router.delete("/{contract_id}/photo", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contract_photo(
    contract_id: str,
    user: UserContext = Depends(ensure_profile),
    db: AsyncSession = Depends(get_db),
) -> Response:
    result = await db.execute(
        select(Contract).where(
            Contract.id == contract_id,
            Contract.owner_user_id == user.user_id,
        )
    )
    contract = result.scalar_one_or_none()
    if contract is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found.")
    if contract.photo_path:
        settings = get_settings()
        storage = _supabase_storage_client()
        try:
            storage.from_(settings.contract_photo_bucket).remove([contract.photo_path])
        except Exception:  # noqa: BLE001
            pass
    contract.photo_path = None
    contract.photo_url = None
    contract.photo_updated_at = None
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
