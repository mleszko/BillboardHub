from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, Enum as SQLEnum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


def _uuid_str() -> str:
    return str(uuid4())


class ContractStatus(str, Enum):
    draft = "draft"
    active = "active"
    expiring_soon = "expiring_soon"
    expired = "expired"
    terminated = "terminated"


class BillboardType(str, Enum):
    classic = "classic"
    citylight = "citylight"
    led = "led"
    backlight = "backlight"
    other = "other"


class ImportStatus(str, Enum):
    uploaded = "uploaded"
    mapped = "mapped"
    confirmed = "confirmed"
    processing = "processing"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class ImportRowStatus(str, Enum):
    pending = "pending"
    valid = "valid"
    invalid = "invalid"
    imported = "imported"


class AppMode(str, Enum):
    auth = "auth"
    demo = "demo"


class Profile(Base):
    __tablename__ = "profiles"

    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    full_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    preferred_mode: Mapped[AppMode] = mapped_column(SQLEnum(AppMode), default=AppMode.auth, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    owner_user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    source_file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_row_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    contract_number: Mapped[str | None] = mapped_column(String(120), nullable=True)
    advertiser_name: Mapped[str] = mapped_column(String(255), nullable=False)
    property_owner_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    billboard_code: Mapped[str | None] = mapped_column(String(120), nullable=True)
    billboard_type: Mapped[BillboardType] = mapped_column(SQLEnum(BillboardType), default=BillboardType.other, nullable=False)
    location_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    monthly_rent_net: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    monthly_rent_gross: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="PLN", nullable=False)
    vat_rate: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    contract_status: Mapped[ContractStatus] = mapped_column(SQLEnum(ContractStatus), default=ContractStatus.draft, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class ImportSession(Base):
    __tablename__ = "import_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    owner_user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    original_file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(20), nullable=False)
    storage_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ImportStatus] = mapped_column(SQLEnum(ImportStatus), default=ImportStatus.uploaded, nullable=False)
    total_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    valid_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    invalid_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    imported_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    llm_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    llm_prompt_version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    mappings: Mapped[list["ImportColumnMapping"]] = relationship(back_populates="import_session", cascade="all, delete-orphan")
    rows: Mapped[list["ImportRow"]] = relationship(back_populates="import_session", cascade="all, delete-orphan")


class ImportColumnMapping(Base):
    __tablename__ = "import_column_mappings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    import_session_id: Mapped[str] = mapped_column(ForeignKey("import_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    source_column_name: Mapped[str] = mapped_column(String(255), nullable=False)
    target_field_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    guessed_confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4), nullable=True)
    guessed_rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    transform_hint: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_required_target: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    confirmed_by_user: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    user_override: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    import_session: Mapped[ImportSession] = relationship(back_populates="mappings")


class ImportRow(Base):
    __tablename__ = "import_rows"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    import_session_id: Mapped[str] = mapped_column(ForeignKey("import_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    source_row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    raw_payload: Mapped[dict[str, Any]] = mapped_column(SQLiteJSON, nullable=False)
    normalized_payload: Mapped[dict[str, Any] | None] = mapped_column(SQLiteJSON, nullable=True)
    validation_errors: Mapped[dict[str, Any] | None] = mapped_column(SQLiteJSON, nullable=True)
    status: Mapped[ImportRowStatus] = mapped_column(SQLEnum(ImportRowStatus), default=ImportRowStatus.pending, nullable=False)
    contract_id: Mapped[str | None] = mapped_column(ForeignKey("contracts.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    import_session: Mapped[ImportSession] = relationship(back_populates="rows")


class HubertConversation(Base):
    __tablename__ = "hubert_conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    owner_user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    mode: Mapped[AppMode] = mapped_column(SQLEnum(AppMode), default=AppMode.demo, nullable=False)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    system_prompt_version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    messages: Mapped[list["HubertMessage"]] = relationship(back_populates="conversation", cascade="all, delete-orphan")


class HubertMessage(Base):
    __tablename__ = "hubert_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid_str)
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("hubert_conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    owner_user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_usage_input: Mapped[int | None] = mapped_column(Integer, nullable=True)
    token_usage_output: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    conversation: Mapped[HubertConversation] = relationship(back_populates="messages")
