from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import UserContext, ensure_profile
from app.core.database import get_db
from app.schemas.imports import (
    ImportExecuteResponse,
    ImportMappingConfirmationRequest,
    ImportMappingProposalResponse,
)
from app.services.import_guesser import generate_mapping_proposal
from app.services.import_processor import confirm_mapping_and_import

router = APIRouter(prefix="/imports", tags=["imports"])


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
