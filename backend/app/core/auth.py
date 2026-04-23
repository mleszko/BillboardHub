from __future__ import annotations

import json
from dataclasses import dataclass
from time import monotonic
from urllib.error import URLError
from urllib.request import urlopen

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.models import Profile

_JWKS_CACHE_TTL_SECONDS = 300.0
_jwks_cache: dict[str, tuple[float, list[dict[str, object]]]] = {}


@dataclass
class UserContext:
    user_id: str
    email: str | None


def _fetch_jwks_keys(issuer_url: str) -> list[dict[str, object]]:
    now = monotonic()
    cached = _jwks_cache.get(issuer_url)
    if cached and (now - cached[0]) < _JWKS_CACHE_TTL_SECONDS:
        return cached[1]

    jwks_url = f"{issuer_url.rstrip('/')}/.well-known/jwks.json"
    try:
        with urlopen(jwks_url, timeout=5) as resp:  # noqa: S310
            payload = json.loads(resp.read().decode("utf-8"))
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to fetch Supabase JWKS.",
        ) from exc

    keys_raw = payload.get("keys")
    if not isinstance(keys_raw, list):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Supabase JWKS payload.",
        )
    keys = [k for k in keys_raw if isinstance(k, dict)]
    _jwks_cache[issuer_url] = (now, keys)
    return keys


def _decode_with_supabase_jwks(token: str) -> dict[str, object]:
    try:
        header = jwt.get_unverified_header(token)
        claims = jwt.get_unverified_claims(token)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token decode failed.",
        ) from exc

    issuer = str(claims.get("iss") or "").strip().rstrip("/")
    if not issuer.startswith("https://"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing/invalid issuer.",
        )

    algorithm = str(header.get("alg") or "").strip()
    if not algorithm:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing algorithm header.",
        )
    key_id = str(header.get("kid") or "").strip()
    keys = _fetch_jwks_keys(issuer)
    candidate_keys = [k for k in keys if str(k.get("kid") or "") == key_id] if key_id else keys
    if not candidate_keys:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No matching JWKS key for token.",
        )

    last_error: JWTError | None = None
    for jwk_key in candidate_keys:
        try:
            return jwt.decode(
                token,
                jwk_key,
                algorithms=[algorithm],
                issuer=issuer,
                options={"verify_aud": False},
            )
        except JWTError as exc:
            last_error = exc

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token signature verification failed.",
    ) from last_error


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
        token_header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token decode failed",
        ) from exc

    alg = str(token_header.get("alg") or "").upper()
    if settings.supabase_jwt_secret and alg.startswith("HS"):
        try:
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
        except JWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token signature verification failed",
            ) from exc
    else:
        payload = _decode_with_supabase_jwks(token)

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
    email = user.email or "unknown@example.com"
    existing = await db.get(Profile, user.user_id)
    if existing is None:
        db.add(Profile(user_id=user.user_id, email=email))
        await db.commit()
    elif user.email and existing.email != user.email:
        existing.email = user.email
        await db.commit()
    return user
