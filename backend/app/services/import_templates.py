"""Preset import parse options (UI can apply these as defaults before calling guess-mapping)."""

from __future__ import annotations

from typing import Any

# IDs are stable API contracts for GET /imports/templates.
IMPORT_TEMPLATE_PRESETS: list[dict[str, Any]] = [
    {
        "id": "default",
        "label": "Standard — automatyczny nagłówek",
        "description": "Wykrywanie wiersza nagłówka automatycznie (zalecane).",
        "options": {
            "header_row_1based": 0,
            "skip_rows_before_header": 0,
            "unpivot_month_columns": False,
            "monthly_aggregate": "mean",
        },
    },
    {
        "id": "header_row_3",
        "label": "Nagłówek w wierszu 3",
        "description": "Typowe dla arkuszy z tytułem i datą nad tabelą.",
        "options": {
            "header_row_1based": 3,
            "skip_rows_before_header": 0,
            "unpivot_month_columns": False,
            "monthly_aggregate": "mean",
        },
    },
    {
        "id": "wide_months_mean",
        "label": "Szeroki kalendarz — złączenie miesięcy (średnia / suma)",
        "description": "Kolumny wyglądające jak miesiące zostaną złączone: czynsz = średnia z miesięcy, wartość okresu = suma.",
        "options": {
            "header_row_1based": 0,
            "skip_rows_before_header": 0,
            "unpivot_month_columns": True,
            "monthly_aggregate": "mean",
        },
    },
    {
        "id": "wide_months_last",
        "label": "Szeroki kalendarz — ostatni miesiąc jako czynsz",
        "description": "Czynsz miesięczny = ostatnia wypełniona kolumna miesięczna; wartość okresu = suma.",
        "options": {
            "header_row_1based": 0,
            "skip_rows_before_header": 0,
            "unpivot_month_columns": True,
            "monthly_aggregate": "last",
        },
    },
]


def get_template_defaults(template_id: str | None) -> dict[str, Any]:
    if not template_id:
        return dict(IMPORT_TEMPLATE_PRESETS[0]["options"])
    for t in IMPORT_TEMPLATE_PRESETS:
        if t["id"] == template_id:
            return dict(t["options"])
    return dict(IMPORT_TEMPLATE_PRESETS[0]["options"])
