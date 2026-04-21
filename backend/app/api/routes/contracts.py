from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import UserContext, ensure_profile
from app.core.database import get_db
from app.constants import PLACEHOLDER_CONTRACT_EXPIRY
from app.models.models import Contract, ContractStatus
from app.schemas.contracts_write import ContractCreateBody, ContractUpdateBody
from app.schemas.imports import ContractsListItem, ContractsListResponse
from app.services.import_processor import _coerce_billboard_type

router = APIRouter(prefix="/contracts", tags=["contracts"])


def _decimal_to_float(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _contract_to_list_item(contract: Contract) -> ContractsListItem:
    return ContractsListItem(
        id=contract.id,
        contract_number=contract.contract_number,
        billboard_code=contract.billboard_code,
        billboard_type=contract.billboard_type.value if contract.billboard_type else None,
        advertiser_name=contract.advertiser_name,
        property_owner_name=contract.property_owner_name,
        city=contract.city,
        location_address=contract.location_address,
        latitude=float(contract.latitude) if contract.latitude is not None else None,
        longitude=float(contract.longitude) if contract.longitude is not None else None,
        surface_size=contract.surface_size,
        start_date=contract.start_date.isoformat() if contract.start_date else None,
        expiry_date=contract.expiry_date.isoformat(),
        expiry_unknown=contract.expiry_date == PLACEHOLDER_CONTRACT_EXPIRY,
        contract_status=contract.contract_status.value,
        monthly_rent_net=_decimal_to_float(contract.monthly_rent_net),
        total_contract_value_net=_decimal_to_float(contract.total_contract_value_net),
        contact_person=contract.contact_person,
        contact_phone=contract.contact_phone,
        contact_email=contract.contact_email,
        notes=contract.notes,
    )


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


@router.get("", response_model=ContractsListResponse)
async def list_contracts(
    user: UserContext = Depends(ensure_profile),
    db: AsyncSession = Depends(get_db),
) -> ContractsListResponse:
    result = await db.execute(
        select(Contract)
        .where(Contract.owner_user_id == user.user_id)
        .order_by(Contract.expiry_date.asc())
        .limit(500)
    )
    contracts = result.scalars().all()
    return ContractsListResponse(items=[_contract_to_list_item(c) for c in contracts])


@router.post("", response_model=ContractsListItem, status_code=status.HTTP_201_CREATED)
async def create_contract(
    body: ContractCreateBody,
    user: UserContext = Depends(ensure_profile),
    db: AsyncSession = Depends(get_db),
) -> ContractsListItem:
    expiry = _resolve_create_expiry(body)
    contract = Contract(
        owner_user_id=user.user_id,
        advertiser_name=body.advertiser_name.strip(),
        contract_number=body.contract_number.strip() if body.contract_number else None,
        billboard_code=body.billboard_code.strip() if body.billboard_code else None,
        billboard_type=_coerce_billboard_type(body.billboard_type),
        city=body.city.strip() if body.city else None,
        location_address=body.location_address.strip() if body.location_address else None,
        surface_size=body.surface_size.strip() if body.surface_size else None,
        start_date=body.start_date,
        expiry_date=expiry,
        monthly_rent_net=body.monthly_rent_net,
        contract_status=_status_for_expiry(expiry),
    )
    db.add(contract)
    await db.commit()
    await db.refresh(contract)
    return _contract_to_list_item(contract)


@router.patch("/{contract_id}", response_model=ContractsListItem)
async def update_contract(
    contract_id: str,
    body: ContractUpdateBody,
    user: UserContext = Depends(ensure_profile),
    db: AsyncSession = Depends(get_db),
) -> ContractsListItem:
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
    if "billboard_type" in updates:
        contract.billboard_type = _coerce_billboard_type(updates["billboard_type"])
    if "city" in updates:
        v = updates["city"]
        contract.city = v.strip() if v else None
    if "location_address" in updates:
        v = updates["location_address"]
        contract.location_address = v.strip() if v else None
    if "surface_size" in updates:
        v = updates["surface_size"]
        contract.surface_size = v.strip() if v else None
    if "start_date" in updates:
        contract.start_date = updates["start_date"]
    if "monthly_rent_net" in updates:
        contract.monthly_rent_net = updates["monthly_rent_net"]

    if "expiry_date" in updates and updates["expiry_date"] is not None:
        contract.expiry_date = updates["expiry_date"]
    elif updates.get("expiry_unknown") is True:
        contract.expiry_date = PLACEHOLDER_CONTRACT_EXPIRY

    contract.contract_status = _status_for_expiry(contract.expiry_date)

    await db.commit()
    await db.refresh(contract)
    return _contract_to_list_item(contract)


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
