from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import UserContext, ensure_profile
from app.core.database import get_db
from app.models.models import Contract, ContractCustomColumn, ContractCustomValue
from app.schemas.imports import ContractCustomColumnItem, ContractCustomValueItem, ContractsListItem, ContractsListResponse

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
            ContractsListItem(
                id=contract.id,
                contract_number=contract.contract_number,
                billboard_code=contract.billboard_code,
                billboard_type=contract.billboard_type.value if contract.billboard_type else None,
                advertiser_name=contract.advertiser_name,
                city=contract.city,
                location_address=contract.location_address,
                latitude=float(contract.latitude) if contract.latitude is not None else None,
                longitude=float(contract.longitude) if contract.longitude is not None else None,
                start_date=contract.start_date.isoformat() if contract.start_date else None,
                expiry_date=contract.expiry_date.isoformat(),
                contract_status=contract.contract_status.value,
                monthly_rent_net=_decimal_to_float(contract.monthly_rent_net),
                custom_values={
                    column_id: ContractCustomValueItem(
                        status=stored_value.status.value,
                        value_text=stored_value.value_text,
                        value_number=_decimal_to_float(stored_value.value_number),
                        error_message=stored_value.error_message,
                        computed_at=stored_value.computed_at.isoformat() if stored_value.computed_at else None,
                    )
                    for column_id, stored_value in values_by_contract.get(contract.id, {}).items()
                },
            )
            for contract in contracts
        ]
    )
