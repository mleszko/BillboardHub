from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class ContractCreateBody(BaseModel):
    advertiser_name: str = Field(min_length=1, max_length=255)
    contract_number: str | None = Field(default=None, max_length=120)
    billboard_code: str | None = Field(default=None, max_length=120)
    asset_name: str | None = Field(default=None, max_length=255)
    billboard_type: str | None = Field(default=None, max_length=64)
    investment_name: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=120)
    location_address: str | None = Field(default=None, max_length=255)
    surface_size: str | None = Field(default=None, max_length=120)
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    gps_coordinates_raw: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=4000)
    start_date: date | None = None
    expiry_date: date | None = None
    expiry_unknown: bool = False
    monthly_rent_net: Decimal | None = None


class ContractUpdateBody(BaseModel):
    advertiser_name: str | None = Field(default=None, min_length=1, max_length=255)
    contract_number: str | None = Field(default=None, max_length=120)
    billboard_code: str | None = Field(default=None, max_length=120)
    asset_name: str | None = Field(default=None, max_length=255)
    billboard_type: str | None = Field(default=None, max_length=64)
    investment_name: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=120)
    location_address: str | None = Field(default=None, max_length=255)
    surface_size: str | None = Field(default=None, max_length=120)
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    gps_coordinates_raw: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=4000)
    start_date: date | None = None
    expiry_date: date | None = None
    expiry_unknown: bool | None = None
    monthly_rent_net: Decimal | None = None
