"""Integration test: full import flow on a locally supplied workbook (path via env only)."""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app

_DEV_HEADERS = {
    "x-dev-user-id": "golden-import-user",
    "x-dev-user-email": "golden@billboardhub.test",
}

# Env-only path so no fixture filename is committed.
_ENV_KEY = "IMPORT_GOLDEN_WORKBOOK_PATH"


def _workbook_path() -> Path | None:
    raw = os.environ.get(_ENV_KEY, "").strip()
    if not raw:
        return None
    p = Path(raw).expanduser()
    return p if p.is_file() else None


@pytest.mark.skipif(_workbook_path() is None, reason=f"Set {_ENV_KEY} to run this test.")
def test_golden_workbook_imports_with_auto_header() -> None:
    path = _workbook_path()
    assert path is not None
    raw = path.read_bytes()
    upload_name = "workbook.xlsx"

    with TestClient(app) as client:
        client.get("/health")

        insp = client.post(
            "/imports/inspect",
            headers=_DEV_HEADERS,
            files={
                "file": (
                    upload_name,
                    raw,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
        assert insp.status_code == 200, insp.text
        sheets = insp.json()["sheets"]
        assert sheets, "Workbook has no sheets"
        sheet_name = sheets[0]["name"]

        guess = client.post(
            "/imports/guess-mapping",
            headers=_DEV_HEADERS,
            files={
                "file": (
                    upload_name,
                    raw,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
            data={
                "sheet_name": sheet_name,
                "header_row_1based": "0",
                "skip_rows_before_header": "0",
                "unpivot_month_columns": "false",
                "monthly_aggregate": "mean",
            },
        )
        assert guess.status_code == 200, guess.text
        proposal = guess.json()
        assert proposal.get("parse_options", {}).get("header_auto") is True
        assert proposal["columns"]

        owner_id = proposal["owner_user_id"]
        payload = {
            "session_id": proposal["session_id"],
            "owner_user_id": owner_id,
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
        result = confirm.json()
        assert result["status"] == "completed"
        assert result["imported_rows"] >= 1
