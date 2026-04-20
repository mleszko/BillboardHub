from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import UserContext, ensure_profile
from app.core.database import get_db
from app.models import Profile

router = APIRouter(prefix="/auth", tags=["auth"])


class MeResponse(BaseModel):
    user_id: str
    email: str
    full_name: str | None = None
    company_name: str | None = None


@router.get("/me", response_model=MeResponse)
async def read_me(
    user: UserContext = Depends(ensure_profile),
    db: AsyncSession = Depends(get_db),
) -> MeResponse:
    profile = await db.get(Profile, user.user_id)
    email = profile.email if profile and profile.email else (user.email or "")
    return MeResponse(
        user_id=user.user_id,
        email=email,
        full_name=profile.full_name if profile else None,
        company_name=profile.company_name if profile else None,
    )
