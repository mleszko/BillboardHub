from __future__ import annotations

from typing import Any

from app.services.import_adapters.known_workbook_v1 import (
    ADAPTER_ID,
    AdapterLoadResult,
    load_workbook as load_known_v1,
    matches_xlsx as matches_known_v1,
)


def try_known_adapter(file_name: str, file_bytes: bytes, sheet_name: str) -> AdapterLoadResult | None:
    """
    If the uploaded file matches a registered known layout, return pre-parsed rows + proposals.
    Otherwise return None (caller uses generic pandas + LLM/heuristics).
    """
    if matches_known_v1(file_name, file_bytes, sheet_name):
        return load_known_v1(file_bytes, sheet_name)
    return None


def adapter_metadata() -> dict[str, Any]:
    return {"registered": [ADAPTER_ID]}
