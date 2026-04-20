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
                "city": "Miasto testowe",
                "expiry_unknown": True,
                "monthly_rent_net": "1200.50",
            },
        )
        assert create.status_code == 201, create.text
        body = create.json()
        assert body["advertiser_name"] == "Sklep"
        assert body["billboard_code"] == "SUW-99"
        assert body["expiry_unknown"] is True
        assert body["expiry_date"] == PLACEHOLDER_CONTRACT_EXPIRY.isoformat()
        cid = body["id"]

        patch = client.patch(
            f"/contracts/{cid}",
            headers=_DEV_HEADERS,
            json={
                "advertiser_name": "Inny klient",
                "expiry_date": "2030-06-15",
                "expiry_unknown": False,
            },
        )
        assert patch.status_code == 200, patch.text
        updated = patch.json()
        assert updated["advertiser_name"] == "Inny klient"
        assert updated["expiry_date"] == "2030-06-15"
        assert updated["expiry_unknown"] is False
