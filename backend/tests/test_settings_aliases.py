from __future__ import annotations

from app.core.config import Settings


def test_supabase_service_key_aliases() -> None:
    settings = Settings(
        SUPABASE_URL="https://example.supabase.co",
        SUPABASE_SERVICE_KEY="service-key-value",
    )
    assert settings.supabase_url == "https://example.supabase.co"
    assert settings.supabase_service_role_key == "service-key-value"


def test_storage_bucket_alias_from_legacy_name() -> None:
    settings = Settings(SUPABASE_STORAGE_BUCKET="legacy-bucket")
    assert settings.contract_photo_bucket == "legacy-bucket"

