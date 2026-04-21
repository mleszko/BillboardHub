"""Test isolation: SQLite file DB + disable external LLM for deterministic imports."""

from __future__ import annotations

import os
from pathlib import Path

_root = Path(__file__).resolve().parent
_db_path = _root / "_pytest_billboardhub.sqlite"

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_db_path}"
os.environ["IMPORT_USE_LLM"] = "false"


def pytest_sessionstart(session: object) -> None:
    _db_path.unlink(missing_ok=True)
