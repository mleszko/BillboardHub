from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.constants import PLACEHOLDER_CONTRACT_EXPIRY
from app.main import app

_DEV_HEADERS = {
    "x-dev-user-id": "contract-write-user",
    "x-dev-user-email": "write@billboardhub.test",
}


def test_create_contract_requires_auth() -> None:
    client = TestClient(app)
    response = client.post("/contracts", json={"advertiser_name": "ACME"})
    assert response.status_code == 401


def test_create_and_patch_contract() -> None:
    with TestClient(app) as client:
        client.get("/health")
        create = client.post(
            "/contracts",
            headers=_DEV_HEADERS,
            json={
                "advertiser_name": "  Sklep  ",
                "billboard_code": "SUW-99",
                "asset_name": "  u matematyka  ",
                "investment_name": "  Modernizacja peronu  ",
                "city": "Miasto testowe",
                "gps_coordinates_raw": "https://maps.app.goo.gl/nDxi3L4cLSowfZK37",
                "expiry_unknown": True,
                "monthly_rent_net": "1200.50",
                "notes": "  Uwagi testowe  ",
            },
        )
        assert create.status_code == 201, create.text
        body = create.json()
        assert body["advertiser_name"] == "Sklep"
        assert body["billboard_code"] == "SUW-99"
        assert body["asset_name"] == "u matematyka"
        assert body["investment_name"] == "Modernizacja peronu"
        assert body["gps_coordinates_raw"] == "https://maps.app.goo.gl/nDxi3L4cLSowfZK37"
        assert body["notes"] == "Uwagi testowe"
        assert body["expiry_unknown"] is True
        assert body["expiry_date"] == PLACEHOLDER_CONTRACT_EXPIRY.isoformat()
        cid = body["id"]

        patch = client.patch(
            f"/contracts/{cid}",
            headers=_DEV_HEADERS,
            json={
                "advertiser_name": "Inny klient",
                "asset_name": "przy mrowce",
                "investment_name": "Nowa inwestycja",
                "gps_coordinates_raw": "https://maps.app.goo.gl/nDxi3L4cLSowfZK37",
                "notes": "Notatka po edycji",
                "expiry_date": "2030-06-15",
                "expiry_unknown": False,
            },
        )
        assert patch.status_code == 200, patch.text
        updated = patch.json()
        assert updated["advertiser_name"] == "Inny klient"
        assert updated["asset_name"] == "przy mrowce"
        assert updated["investment_name"] == "Nowa inwestycja"
        assert updated["gps_coordinates_raw"] == "https://maps.app.goo.gl/nDxi3L4cLSowfZK37"
        assert updated["notes"] == "Notatka po edycji"
        assert updated["expiry_date"] == "2030-06-15"
        assert updated["expiry_unknown"] is False


def test_delete_all_contracts_only_for_current_user() -> None:
    with TestClient(app) as client:
        client.get("/health")
        user_a = {"x-dev-user-id": "bulk-delete-a", "x-dev-user-email": "a@billboardhub.test"}
        user_b = {"x-dev-user-id": "bulk-delete-b", "x-dev-user-email": "b@billboardhub.test"}

        create_a = client.post("/contracts", headers=user_a, json={"advertiser_name": "A1", "expiry_unknown": True})
        assert create_a.status_code == 201, create_a.text
        create_b = client.post("/contracts", headers=user_b, json={"advertiser_name": "B1", "expiry_unknown": True})
        assert create_b.status_code == 201, create_b.text

        delete_all = client.delete("/contracts", headers=user_a)
        assert delete_all.status_code == 204, delete_all.text

        list_a = client.get("/contracts", headers=user_a)
        assert list_a.status_code == 200, list_a.text
        assert list_a.json()["items"] == []

        list_b = client.get("/contracts", headers=user_b)
        assert list_b.status_code == 200, list_b.text
        assert len(list_b.json()["items"]) == 1


def test_delete_contract_photo_removes_file_from_storage(monkeypatch) -> None:
    removed_paths: list[str] = []
    uploaded_paths: list[str] = []

    class FakeBucket:
        def upload(self, path: str, raw: bytes, options: dict[str, str]) -> None:
            assert raw
            assert options.get("content-type") == "image/png"
            uploaded_paths.append(path)

        def remove(self, paths: list[str]) -> None:
            removed_paths.extend(paths)

        def get_public_url(self, path: str) -> str:
            return f"https://storage.local/{path}"

        def create_signed_url(self, path: str, expires_in: int) -> dict[str, str]:
            assert expires_in > 0
            return {"signedURL": f"https://storage.local/signed/{path}"}

    class FakeStorage:
        def __init__(self) -> None:
            self.bucket = FakeBucket()

        def from_(self, bucket_name: str) -> FakeBucket:
            assert bucket_name == "contract-photos"
            return self.bucket

    class FakeSupabaseClient:
        def __init__(self) -> None:
            self.storage = FakeStorage()

    monkeypatch.setattr("app.api.routes.contracts.create_client", lambda _url, _key: FakeSupabaseClient())
    monkeypatch.setattr(
        "app.api.routes.contracts.get_settings",
        lambda: SimpleNamespace(
            supabase_url="https://supabase.local",
            supabase_service_role_key="service-role",
            contract_photo_bucket="contract-photos",
            contract_photo_max_bytes=2_000_000,
            contract_photo_max_dimension_px=1600,
        ),
    )

    with TestClient(app) as client:
        client.get("/health")
        created = client.post(
            "/contracts",
            headers=_DEV_HEADERS,
            json={"advertiser_name": "Photo Test", "expiry_unknown": True},
        )
        assert created.status_code == 201, created.text
        contract_id = created.json()["id"]

        uploaded = client.post(
            f"/contracts/{contract_id}/photo",
            headers=_DEV_HEADERS,
            files={"photo": ("photo.png", b"\x89PNG\r\n\x1a\nfake", "image/png")},
            data={"width": "120", "height": "80"},
        )
        assert uploaded.status_code == 200, uploaded.text
        assert uploaded_paths, "Upload should write photo path."

        deleted = client.delete(f"/contracts/{contract_id}/photo", headers=_DEV_HEADERS)
        assert deleted.status_code == 204, deleted.text
        assert removed_paths == [uploaded_paths[-1]]

        listed = client.get("/contracts", headers=_DEV_HEADERS)
        assert listed.status_code == 200, listed.text
        row = next((item for item in listed.json()["items"] if item["id"] == contract_id), None)
        assert row is not None
        assert row["photo_url"] is None
