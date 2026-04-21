from collections.abc import AsyncGenerator

from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.models import Base

settings = get_settings()
engine = create_async_engine(settings.database_url, future=True, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

_CONTRACT_ALTER_COLUMNS: tuple[tuple[str, str], ...] = (
    ("surface_size", "VARCHAR(120)"),
    ("contact_person", "VARCHAR(255)"),
    ("contact_phone", "VARCHAR(64)"),
    ("contact_email", "VARCHAR(255)"),
    ("total_contract_value_net", "NUMERIC(14, 2)"),
)


def _ensure_contract_columns(sync_conn) -> None:
    """Add columns missing from older SQLite/Postgres DBs (create_all does not ALTER)."""
    insp = inspect(sync_conn)
    if not insp.has_table("contracts"):
        return
    existing = {c["name"] for c in insp.get_columns("contracts")}
    dialect = sync_conn.dialect.name
    for col_name, ddl_sqlite in _CONTRACT_ALTER_COLUMNS:
        if col_name in existing:
            continue
        ddl = ddl_sqlite if dialect == "sqlite" else ddl_sqlite.replace("NUMERIC(14, 2)", "NUMERIC(14,2)")
        sync_conn.execute(text(f'ALTER TABLE contracts ADD COLUMN "{col_name}" {ddl}'))
        existing.add(col_name)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_ensure_contract_columns)
