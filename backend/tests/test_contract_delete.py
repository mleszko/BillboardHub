from fastapi.testclient import TestClient

from app.main import app


def test_delete_contract_requires_auth() -> None:
    client = TestClient(app)
    response = client.delete("/contracts/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 401
