import asyncio

import pytest
from sqlalchemy.exc import IntegrityError

from app.core.auth import UserContext, ensure_profile
from app.models import Profile


def test_ensure_profile_handles_concurrent_profile_insert_race() -> None:
    class FakeSession:
        def __init__(self) -> None:
            self.get_calls = 0
            self.commit_calls = 0
            self.rollback_calls = 0
            self.added: Profile | None = None

        async def get(self, _model: type[Profile], user_id: str) -> Profile | None:
            self.get_calls += 1
            if self.get_calls == 1:
                return None
            return Profile(user_id=user_id, email="user@example.com")

        def add(self, profile: Profile) -> None:
            self.added = profile

        async def commit(self) -> None:
            self.commit_calls += 1
            if self.commit_calls == 1:
                raise IntegrityError("INSERT INTO profiles ...", {}, Exception("duplicate key"))

        async def rollback(self) -> None:
            self.rollback_calls += 1

    db = FakeSession()
    user = UserContext(user_id="u-1", email="user@example.com")

    result = asyncio.run(ensure_profile(user=user, db=db))

    assert result is user
    assert db.added is not None
    assert db.rollback_calls == 1
    assert db.commit_calls == 1


def test_ensure_profile_reraises_integrity_error_if_profile_still_missing() -> None:
    class FakeSession:
        async def get(self, _model: type[Profile], _user_id: str) -> Profile | None:
            return None

        def add(self, _profile: Profile) -> None:
            return None

        async def commit(self) -> None:
            raise IntegrityError("INSERT INTO profiles ...", {}, Exception("duplicate key"))

        async def rollback(self) -> None:
            return None

    db = FakeSession()
    user = UserContext(user_id="u-2", email="user@example.com")

    with pytest.raises(IntegrityError):
        asyncio.run(ensure_profile(user=user, db=db))
