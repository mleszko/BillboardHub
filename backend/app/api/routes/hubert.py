from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import UserContext, ensure_profile
from app.core.database import get_db
from app.schemas.hubert import HubertChatRequest, HubertChatResponse
from app.services.hubert import DemoModeOnlyError, hubert_service

router = APIRouter(prefix="/hubert", tags=["hubert"])


@router.post("/ask", response_model=HubertChatResponse)
async def ask_hubert_endpoint(
    payload: HubertChatRequest,
    user: UserContext = Depends(ensure_profile),
    db: AsyncSession = Depends(get_db),
) -> HubertChatResponse:
    try:
        return await hubert_service.chat(db=db, request=payload, user_id=user.user_id)
    except DemoModeOnlyError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
