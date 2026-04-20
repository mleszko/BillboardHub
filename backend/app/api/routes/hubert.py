from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import UserContext, ensure_profile
from app.core.database import get_db
from app.schemas.hubert import HubertRequest, HubertResponse
from app.services.hubert import DemoModeOnlyError, hubert_service

router = APIRouter(prefix="/hubert", tags=["hubert"])


@router.post("/ask", response_model=HubertResponse)
async def ask_hubert_endpoint(
    payload: HubertRequest,
    user: UserContext = Depends(ensure_profile),
    db: AsyncSession = Depends(get_db),
) -> HubertResponse:
    try:
        return await hubert_service.chat(db=db, request=payload, user_id=user.user_id)
    except DemoModeOnlyError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
