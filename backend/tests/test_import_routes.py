from fastapi.testclient import TestClient

from app.main import app


def test_import_inspect_registered_in_openapi() -> None:
    client = TestClient(app)
    response = client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/imports/inspect" in paths
    assert "post" in paths["/imports/inspect"]


def test_api_prefixed_import_inspect_route_exists() -> None:
    """Mirrored under /api for proxies; omitted from OpenAPI to avoid duplicates."""
    client = TestClient(app)
    response = client.post("/api/imports/inspect")
    assert response.status_code != 404
