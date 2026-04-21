from __future__ import annotations

import asyncio
from io import BytesIO

from fastapi.testclient import TestClient
from openpyxl import Workbook

from app.core.auth import UserContext, ensure_profile
from app.core.database import init_db
from app.main import app
from app.services.import_adapters.fingerprint import header_fingerprint_from_column_names


def _build_multisheet_workbook() -> bytes:
    headers = [
        "l.p.",
        "miasto",
        "lokalizacja",
        "uwagi",
        "powierzchnia",
        "wynajmujący",
        "osoba kontaktowa",
        "telefon osoby kontaktowej",
        "e-mail osoby kontaktowej",
        "czas trwania umowy",
        "koszt miesięczny netto",
        "koszt za cały okres trwania umowy",
    ]
    wb = Workbook()
    ws1 = wb.active
    ws1.title = "Suwałki"
    ws1.append(headers)
    ws1.append([1, "Suwałki", "Adres 1", "uwagi", "2x1", "Firma A", "Jan", "111", "a@a.pl", "2026-12-31", 100, 1200])
    ws2 = wb.create_sheet("Białystok")
    ws2.append(headers)
    ws2.append([1, "Białystok", "Adres 2", "uwagi", "3x1", "Firma B", "Anna", "222", "b@b.pl", "2027-12-31", 200, 2400])
    buff = BytesIO()
    wb.save(buff)
    return buff.getvalue()


def test_guess_mapping_batch_creates_per_sheet_sessions(monkeypatch) -> None:
    headers = [
        "l.p.",
        "miasto",
        "lokalizacja",
        "uwagi",
        "powierzchnia",
        "wynajmujący",
        "osoba kontaktowa",
        "telefon osoby kontaktowej",
        "e-mail osoby kontaktowej",
        "czas trwania umowy",
        "koszt miesięczny netto",
        "koszt za cały okres trwania umowy",
    ]
    fingerprint = header_fingerprint_from_column_names(headers)
    monkeypatch.setattr(
        "app.services.import_adapters.known_workbook_v1.HEADER_FINGERPRINTS",
        frozenset({fingerprint}),
    )

    async def _fake_user() -> UserContext:
        return UserContext(user_id="user-batch-1", email="batch@example.com")

    app.dependency_overrides[ensure_profile] = _fake_user
    asyncio.run(init_db())
    client = TestClient(app)
    data = _build_multisheet_workbook()

    response = client.post(
        "/imports/guess-mapping-batch",
        files={"file": ("portfolio.xlsx", data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        data={"sheet_names": ["Suwałki", "Białystok"], "sheet_name": "Suwałki", "header_row_1based": "1"},
        headers={"x-dev-user-id": "user-batch-1", "x-dev-user-email": "batch@example.com"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["sheets"]) == 2
    assert payload["sheets"][0]["proposal"]["parse_options"]["resolved_sheet"] == "Suwałki"
    assert payload["sheets"][1]["proposal"]["parse_options"]["resolved_sheet"] == "Białystok"
    assert payload["sheets"][0]["proposal"]["guessed_by_model"] == "adapter:known_workbook_v1"
    app.dependency_overrides.clear()


def test_confirm_mapping_batch_aggregates_results(monkeypatch) -> None:
    headers = [
        "l.p.",
        "miasto",
        "lokalizacja",
        "uwagi",
        "powierzchnia",
        "wynajmujący",
        "osoba kontaktowa",
        "telefon osoby kontaktowej",
        "e-mail osoby kontaktowej",
        "czas trwania umowy",
        "koszt miesięczny netto",
        "koszt za cały okres trwania umowy",
    ]
    fingerprint = header_fingerprint_from_column_names(headers)
    monkeypatch.setattr(
        "app.services.import_adapters.known_workbook_v1.HEADER_FINGERPRINTS",
        frozenset({fingerprint}),
    )

    async def _fake_user() -> UserContext:
        return UserContext(user_id="user-batch-2", email="batch2@example.com")

    app.dependency_overrides[ensure_profile] = _fake_user
    asyncio.run(init_db())
    client = TestClient(app)
    data = _build_multisheet_workbook()
    guess = client.post(
        "/imports/guess-mapping-batch",
        files={"file": ("portfolio.xlsx", data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        data={"sheet_names": ["Suwałki", "Białystok"], "sheet_name": "Suwałki", "header_row_1based": "1"},
        headers={"x-dev-user-id": "user-batch-2", "x-dev-user-email": "batch2@example.com"},
    )
    assert guess.status_code == 200
    guessed = guess.json()

    sheets = []
    for item in guessed["sheets"]:
        sheets.append(
            {
                "sheet_name": item["sheet_name"],
                "session_id": item["proposal"]["session_id"],
                "mapping": [
                    {
                        "source_column_name": m["source_column_name"],
                        "target_field_name": m["target_field_name"],
                        "confirmed_by_user": True,
                        "user_override": True,
                        "transform_hint": m.get("transform_hint"),
                    }
                    for m in item["proposal"]["mapping_suggestions"]
                ],
                "sheet_overrides": [],
            }
        )

    confirm = client.post(
        "/imports/confirm-mapping-batch",
        json={"owner_user_id": "user-batch-2", "sheets": sheets},
        headers={"x-dev-user-id": "user-batch-2", "x-dev-user-email": "batch2@example.com"},
    )
    assert confirm.status_code == 200
    payload = confirm.json()
    assert payload["imported_rows"] == 2
    assert payload["total_rows"] == 2
    assert len(payload["sheets"]) == 2
    app.dependency_overrides.clear()
