from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import UserContext, ensure_profile
from app.core.database import get_db
from app.schemas.imports import (
    ContractCustomColumnCreateRequest,
    ContractCustomColumnCreateResponse,
    ContractCustomColumnsListResponse,
)
from app.services.custom_columns import (
    create_custom_column,
    list_custom_columns,
    recompute_custom_values_for_column,
)

router = APIRouter(prefix="/contracts/custom-columns", tags=["custom-columns"])


@router.get("", response_model=ContractCustomColumnsListResponse)
async def get_custom_columns(
    user: UserContext = Depends(ensure_profile),
    db: AsyncSession = Depends(get_db),
) -> ContractCustomColumnsListResponse:
    columns = await list_custom_columns(db=db, owner_user_id=user.user_id)
    return ContractCustomColumnsListResponse(items=columns)


@router.post("", response_model=ContractCustomColumnCreateResponse)
async def post_custom_column(
    payload: ContractCustomColumnCreateRequest,
    user: UserContext = Depends(ensure_profile),
    db: AsyncSession = Depends(get_db),
) -> ContractCustomColumnCreateResponse:
    if payload.owner_user_id != user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only create custom columns for your own profile.",
        )
    column = await create_custom_column(
        db=db,
        owner_user_id=user.user_id,
        name=payload.name,
        prompt_template=payload.prompt_template,
        output_type=payload.output_type,
    )
    await recompute_custom_values_for_column(db=db, owner_user_id=user.user_id, column=column)
    await db.commit()
    return ContractCustomColumnCreateResponse(column=column)
