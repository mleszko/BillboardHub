from pathlib import Path
from io import BytesIO

from fastapi.testclient import TestClient
from openpyxl import Workbook

from app.main import app

_DEV_HEADERS = {
    "x-dev-user-id": "import-dedupe-user",
    "x-dev-user-email": "import-dedupe@billboardhub.test",
}


def _run_import(client: TestClient, raw_csv: bytes) -> dict:
    guess = client.post(
        "/imports/guess-mapping",
        headers=_DEV_HEADERS,
        files={"file": ("sample_import.csv", raw_csv, "text/csv")},
        data={
            "sheet_name": "",
            "header_row_1based": "0",
            "skip_rows_before_header": "0",
            "unpivot_month_columns": "false",
            "monthly_aggregate": "mean",
        },
    )
    assert guess.status_code == 200, guess.text
    proposal = guess.json()
    payload = {
        "session_id": proposal["session_id"],
        "owner_user_id": proposal["owner_user_id"],
        "mapping": [
            {
                "source_column_name": m["source_column_name"],
                "target_field_name": m["target_field_name"],
                "confirmed_by_user": True,
                "user_override": True,
                "transform_hint": m.get("transform_hint"),
            }
            for m in proposal["mapping_suggestions"]
        ],
    }
    confirm = client.post("/imports/confirm-mapping", headers=_DEV_HEADERS, json=payload)
    assert confirm.status_code == 200, confirm.text
    return confirm.json()


def _build_multisheet_workbook() -> bytes:
    wb = Workbook()
    ws1 = wb.active
    ws1.title = "Arkusz A"
    ws1.append(["Najemca", "Miasto", "Adres", "Data_wygasniecia"])
    ws1.append(["Klient A", "Warszawa", "Marszalkowska 1", "2026-12-31"])
    ws2 = wb.create_sheet("Arkusz B")
    ws2.append(["Wynajmujący", "Miasto", "Adres", "Data_wygasniecia"])
    ws2.append(["Wlasciciel B", "Krakow", "Dluga 2", "2026-12-31"])
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _build_multisheet_lp_workbook() -> bytes:
    wb = Workbook()
    ws1 = wb.active
    ws1.title = "A"
    ws1.append(["l.p.", "Najemca", "Miasto", "Adres", "Data_wygasniecia"])
    ws1.append([1, "Klient A", "Warszawa", "Adres A", "2026-12-31"])
    ws2 = wb.create_sheet("B")
    ws2.append(["l.p.", "Najemca", "Miasto", "Adres", "Data_wygasniecia"])
    ws2.append([1, "Klient B", "Krakow", "Adres B", "2026-12-31"])
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_reimport_does_not_duplicate_contracts() -> None:
    sample = Path(__file__).with_name("sample_import.csv").read_bytes()
    with TestClient(app) as client:
        client.get("/health")
        first = _run_import(client, sample)
        assert first["status"] == "completed"
        assert first["imported_rows"] >= 1

        list_after_first = client.get("/contracts", headers=_DEV_HEADERS)
        assert list_after_first.status_code == 200, list_after_first.text
        first_count = len(list_after_first.json()["items"])
        assert first_count >= 1

        second = _run_import(client, sample)
        assert second["status"] == "completed"

        list_after_second = client.get("/contracts", headers=_DEV_HEADERS)
        assert list_after_second.status_code == 200, list_after_second.text
        second_count = len(list_after_second.json()["items"])
        assert second_count == first_count


def test_reimport_without_contract_number_or_billboard_code_uses_composite_fallback() -> None:
    csv_without_keys = (
        "Najemca,Miasto,Adres,Data_wygasniecia,Czynsz_netto\n"
        "Miejski Ośrodek Pomocy Rodzinie w Suwałkach,Suwałki,"
        "\"ul. Sportowa, reklama działki dla Tomasza Wlazło\",2026-12-31,4200\n"
    ).encode("utf-8")
    with TestClient(app) as client:
        client.get("/health")
        _run_import(client, csv_without_keys)
        first_list = client.get("/contracts", headers=_DEV_HEADERS)
        assert first_list.status_code == 200, first_list.text
        first_count = len(first_list.json()["items"])
        assert first_count >= 1

        _run_import(client, csv_without_keys)
        second_list = client.get("/contracts", headers=_DEV_HEADERS)
        assert second_list.status_code == 200, second_list.text
        second_count = len(second_list.json()["items"])
        assert second_count == first_count


def test_import_without_client_mapping_still_creates_record_with_placeholder() -> None:
    csv_unmapped = (
        "foo_col,bar_col\n"
        "abc,def\n"
    ).encode("utf-8")
    with TestClient(app) as client:
        client.get("/health")
        result = _run_import(client, csv_unmapped)
        assert result["status"] == "completed"
        assert result["imported_rows"] >= 1

        listed = client.get("/contracts", headers=_DEV_HEADERS)
        assert listed.status_code == 200, listed.text
        items = listed.json()["items"]
        assert any(item["advertiser_name"] == "DO_UZUPELNIENIA" for item in items)


def test_multisheet_guess_mapping_accepts_sheet_names() -> None:
    workbook = _build_multisheet_workbook()
    with TestClient(app) as client:
        client.get("/health")
        guess = client.post(
            "/imports/guess-mapping",
            headers=_DEV_HEADERS,
            files={"file": ("multi.xlsx", workbook, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={
                "sheet_name": "Arkusz A",
                "sheet_names": ["Arkusz A", "Arkusz B"],
                "header_row_1based": "0",
                "skip_rows_before_header": "0",
                "unpivot_month_columns": "false",
                "monthly_aggregate": "mean",
            },
        )
        assert guess.status_code == 200, guess.text
        body = guess.json()
        assert body["total_rows"] == 2
        assert set(body.get("parse_options", {}).get("sheet_names", [])) == {"Arkusz A", "Arkusz B"}


def test_multisheet_import_with_sheet_override_per_row() -> None:
    workbook = _build_multisheet_workbook()
    with TestClient(app) as client:
        client.get("/health")
        guess = client.post(
            "/imports/guess-mapping",
            headers=_DEV_HEADERS,
            files={"file": ("multi.xlsx", workbook, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={
                "sheet_names": ["Arkusz A", "Arkusz B"],
                "header_row_1based": "0",
                "skip_rows_before_header": "0",
                "unpivot_month_columns": "false",
                "monthly_aggregate": "mean",
            },
        )
        assert guess.status_code == 200, guess.text
        proposal = guess.json()
        base_mapping = []
        for row in proposal["mapping_suggestions"]:
            target = row["target_field_name"]
            if row["source_column_name"] == "Wynajmujący":
                target = None
            base_mapping.append(
                {
                    "source_column_name": row["source_column_name"],
                    "target_field_name": target,
                    "confirmed_by_user": True,
                    "user_override": True,
                    "transform_hint": row.get("transform_hint"),
                }
            )
        payload = {
            "session_id": proposal["session_id"],
            "owner_user_id": proposal["owner_user_id"],
            "mapping": base_mapping,
            "sheet_overrides": [
                {
                    "sheet_name": "Arkusz B",
                    "mapping": [
                        {
                            "source_column_name": row["source_column_name"],
                            "target_field_name": (
                                "property_owner_name"
                                if row["source_column_name"] == "Wynajmujący"
                                else row["target_field_name"]
                            ),
                            "confirmed_by_user": True,
                            "user_override": row["source_column_name"] == "Wynajmujący",
                            "transform_hint": row.get("transform_hint"),
                        }
                        for row in proposal["mapping_suggestions"]
                    ],
                }
            ],
        }
        confirm = client.post("/imports/confirm-mapping", headers=_DEV_HEADERS, json=payload)
        assert confirm.status_code == 200, confirm.text
        result = confirm.json()
        assert result["status"] == "completed"
        assert result["imported_rows"] == 2

        listed = client.get("/contracts", headers=_DEV_HEADERS)
        assert listed.status_code == 200, listed.text
        items = listed.json()["items"]
        advertiser_names = {item["advertiser_name"] for item in items}
        assert "Klient A" in advertiser_names
        assert "Wlasciciel B" in advertiser_names


def test_confirm_mapping_blocks_lp_contract_number_in_multisheet() -> None:
    workbook = _build_multisheet_lp_workbook()
    with TestClient(app) as client:
        client.get("/health")
        guess = client.post(
            "/imports/guess-mapping",
            headers=_DEV_HEADERS,
            files={"file": ("multi_lp.xlsx", workbook, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={
                "sheet_names": ["A", "B"],
                "header_row_1based": "0",
                "skip_rows_before_header": "0",
                "unpivot_month_columns": "false",
                "monthly_aggregate": "mean",
            },
        )
        assert guess.status_code == 200, guess.text
        proposal = guess.json()
        forced_mapping = []
        for row in proposal["mapping_suggestions"]:
            target = row["target_field_name"]
            if row["source_column_name"] == "l.p.":
                target = "contract_number"
            forced_mapping.append(
                {
                    "source_column_name": row["source_column_name"],
                    "target_field_name": target,
                    "confirmed_by_user": True,
                    "user_override": True,
                    "transform_hint": row.get("transform_hint"),
                }
            )
        confirm = client.post(
            "/imports/confirm-mapping",
            headers=_DEV_HEADERS,
            json={
                "session_id": proposal["session_id"],
                "owner_user_id": proposal["owner_user_id"],
                "mapping": forced_mapping,
            },
        )
        assert confirm.status_code == 200, confirm.text
        result = confirm.json()
        assert result["status"] == "completed"
        assert result["imported_rows"] == 2

        listed = client.get("/contracts", headers=_DEV_HEADERS)
        assert listed.status_code == 200, listed.text
        items = listed.json()["items"]
        assert len(items) >= 2
        matching = [item for item in items if item["advertiser_name"] in {"Klient A", "Klient B"}]
        assert len(matching) >= 2
        assert {"Klient A", "Klient B"}.issubset({item["advertiser_name"] for item in matching})
        assert all(item["contract_number"] in (None, "") for item in matching)
