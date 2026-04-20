from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.models import Profile


@dataclass
class UserContext:
    user_id: str
    email: str | None


async def get_current_user(
    authorization: str | None = Header(default=None),
    x_dev_user_id: str | None = Header(default=None),
    x_dev_user_email: str | None = Header(default=None),
) -> UserContext:
    """
    Decode Supabase JWT from Authorization header.
    Local development fallback uses x-dev-user-id / x-dev-user-email.
    """
    settings = get_settings()

    if not authorization:
        if x_dev_user_id:
            return UserContext(user_id=x_dev_user_id, email=x_dev_user_email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    if not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization scheme",
        )

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    try:
        if settings.supabase_jwt_secret:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
        else:
            payload = jwt.get_unverified_claims(token)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token decode failed",
        ) from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject",
        )

    return UserContext(user_id=user_id, email=payload.get("email"))


async def ensure_profile(
    user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserContext:
    existing = await db.get(Profile, user.user_id)
    if existing is None:
        db.add(Profile(user_id=user.user_id, email=user.email or "unknown@example.com"))
        await db.commit()
    return user
