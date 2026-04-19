from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import UserContext, ensure_profile
from app.core.database import get_db
from app.models.models import Contract
from app.schemas.imports import ContractsListItem, ContractsListResponse

router = APIRouter(prefix="/contracts", tags=["contracts"])


def _decimal_to_float(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value)


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
    return ContractsListResponse(
        items=[
            ContractsListItem(
                id=contract.id,
                contract_number=contract.contract_number,
                advertiser_name=contract.advertiser_name,
                city=contract.city,
                expiry_date=contract.expiry_date.isoformat(),
                contract_status=contract.contract_status.value,
                monthly_rent_net=_decimal_to_float(contract.monthly_rent_net),
            )
            for contract in contracts
        ]
    )
