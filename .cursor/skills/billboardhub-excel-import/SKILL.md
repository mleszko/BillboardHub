---
name: billboardhub-excel-import
description: >-
  Excel/CSV import pipeline: inspect, guess-mapping, confirm-mapping, header auto-detection,
  placeholder expiry, row noise, and golden workbook testing. Use when changing import behavior,
  parse_date, Contract creation from imports, or import UI.
---

# Excel import (BillboardHub)

## Flow

1. `POST /imports/inspect` — sheet metadata.
2. `POST /imports/guess-mapping` — parses sheet (`read_tabular_dataframe`), optional wide-month collapse, LLM or heuristics, creates `ImportSession` + column mappings.
3. `POST /imports/confirm-mapping` — `import_processor.confirm_mapping_and_import` writes `Contract` rows.

## Key modules

| Area | Module |
|------|--------|
| Read / header guess / noise rows | `backend/app/services/import_excel.py` |
| Column heuristics | `backend/app/services/import_guesser.py` (`parse_date`, `parse_decimal`) |
| DB + validation | `backend/app/services/import_processor.py` |
| Routes | `backend/app/api/routes/imports.py` |
| Placeholder end date | `backend/app/constants.py` → `PLACEHOLDER_CONTRACT_EXPIRY`; API sets `expiry_unknown` |

## Semantics

- Missing real `expiry_date` in row → store `PLACEHOLDER_CONTRACT_EXPIRY` (2099-12-31); **do not** fabricate year from upload filename as a user-visible lease end.
- `expiry_unknown` on list API drives UI honesty (no fake “days left” bars).
- `parse_date`: reject small integers and 0 (Excel row / epoch garbage); Excel serials via `openpyxl` path when numeric.

## Tests

- Optional golden: set `IMPORT_GOLDEN_WORKBOOK_PATH` to a local `.xlsx`; `tests/test_golden_workbook_import.py`.
- Default pytest uses `conftest.py` DB + `IMPORT_USE_LLM=false`.

## Frontend

- Root app: `src/routes/import.tsx` (inspect → configure → mapping → confirm).
- Do not embed secret workbook names in repo tests or rules.
