from pydantic import BaseModel, Field


CANONICAL_FIELDS = [
    "contract_number",
    "advertiser_name",
    "property_owner_name",
    "billboard_code",
    "billboard_type",
    "location_address",
    "city",
    "latitude",
    "longitude",
    "start_date",
    "expiry_date",
    "monthly_rent_net",
    "monthly_rent_gross",
    "currency",
    "vat_rate",
    "notes",
]
REQUIRED_IMPORT_FIELDS = {"advertiser_name", "expiry_date"}


class MappingProposal(BaseModel):
    source_column_name: str
    target_field_name: str | None = None
    guessed_confidence: float = Field(ge=0.0, le=1.0)
    guessed_rationale: str
    transform_hint: str | None = None
    is_required_target: bool = False


class MappingGuessesResponse(BaseModel):
    proposals: list[MappingProposal]
    guessed_by_model: str
    prompt_version: str = "v1"
    warning: str | None = None


class ImportMappingProposalResponse(BaseModel):
    session_id: str
    file_name: str
    owner_user_id: str
    total_rows: int
    columns: list[str]
    mapping_suggestions: list[MappingProposal]
    guessed_by_model: str
    warning: str | None = None


class MappingConfirmationItem(BaseModel):
    source_column_name: str
    target_field_name: str | None = None
    confirmed_by_user: bool = True
    user_override: bool = False
    transform_hint: str | None = None


class ImportMappingConfirmationRequest(BaseModel):
    session_id: str
    owner_user_id: str
    mapping: list[MappingConfirmationItem]


class ImportExecuteResponse(BaseModel):
    session_id: str
    status: str
    total_rows: int
    valid_rows: int
    invalid_rows: int
    imported_rows: int
    errors_preview: list[dict]


class ContractsListItem(BaseModel):
    id: str
    contract_number: str | None
    billboard_code: str | None = None
    billboard_type: str | None = None
    advertiser_name: str
    city: str | None
    location_address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    start_date: str | None = None
    expiry_date: str
    contract_status: str
    monthly_rent_net: float | None


class ContractsListResponse(BaseModel):
    items: list[ContractsListItem]

