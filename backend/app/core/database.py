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
    ("asset_name", "VARCHAR(255)"),
    ("investment_name", "VARCHAR(255)"),
    ("gps_coordinates_raw", "VARCHAR(255)"),
    ("photo_path", "TEXT"),
    ("photo_url", "TEXT"),
    ("photo_updated_at", "TIMESTAMP WITH TIME ZONE"),
)

_CONTRACT_VARCHAR_TARGET_LENGTHS: dict[str, int] = {
    "surface_size": 120,
    "contact_person": 255,
    "contact_phone": 64,
    "contact_email": 255,
    "asset_name": 255,
    "investment_name": 255,
    "gps_coordinates_raw": 255,
}


def _contract_column_needs_type_upgrade(column: dict[str, object], column_name: str) -> bool:
    target_length = _CONTRACT_VARCHAR_TARGET_LENGTHS.get(column_name)
    if target_length is None:
        return False

    current_length = getattr(column.get("type"), "length", None)
    if not isinstance(current_length, int):
        return False
    return current_length < target_length


def _ensure_contract_columns(sync_conn) -> None:
    """Add columns missing from older SQLite/Postgres DBs (create_all does not ALTER)."""
    insp = inspect(sync_conn)
    if not insp.has_table("contracts"):
        return
    column_meta = {c["name"]: c for c in insp.get_columns("contracts")}
    existing = set(column_meta.keys())
    dialect = sync_conn.dialect.name
    for col_name, ddl_sqlite in _CONTRACT_ALTER_COLUMNS:
        if col_name in existing:
            continue
        ddl = ddl_sqlite if dialect == "sqlite" else ddl_sqlite.replace("NUMERIC(14, 2)", "NUMERIC(14,2)")
        sync_conn.execute(text(f'ALTER TABLE contracts ADD COLUMN "{col_name}" {ddl}'))
        existing.add(col_name)
        column_meta[col_name] = {"name": col_name}

    if dialect != "postgresql":
        return

    for col_name, ddl_postgres in _CONTRACT_ALTER_COLUMNS:
        column = column_meta.get(col_name)
        if column is None or not _contract_column_needs_type_upgrade(column, col_name):
            continue
        sync_conn.execute(text(f'ALTER TABLE contracts ALTER COLUMN "{col_name}" TYPE {ddl_postgres}'))


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_ensure_contract_columns)
