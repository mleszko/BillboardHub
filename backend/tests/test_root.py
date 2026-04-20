from fastapi.testclient import TestClient

from app.main import app


def test_root_endpoint() -> None:
    client = TestClient(app)
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"service": "billboardhub-api", "status": "ok"}
