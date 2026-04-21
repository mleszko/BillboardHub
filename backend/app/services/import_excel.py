"""Excel/CSV loading, sheet inspection, wide-month unpivot, and row noise detection."""

from __future__ import annotations

import io
import re
from typing import Any, Literal

import pandas as pd

MONTH_COLUMN_PATTERN = re.compile(
    r"^("
    r"sty|styczeń|stycz|jan|january|"
    r"lut|luty|feb|february|"
    r"mar|marzec|march|"
    r"kw|kwie|kwiecień|apr|april|"
    r"maj|may|"
    r"cze|czerw|czerwiec|jun|june|"
    r"lip|lipiec|jul|july|"
    r"sie|sierp|sierpień|aug|august|"
    r"wrz|wrzes|wrzesień|sep|sept|september|"
    r"paź|paz|październik|oct|october|"
    r"lis|listopad|nov|november|"
    r"gru|grudzień|dec|december|"
    r"\d{4}[-_/]?\d{1,2}|"
    r"\d{1,2}[-_/]\d{4}"
    r")(\b|_|$)|"
    r"^(m\d{1,2}|y\d{4}|q[1-4][-_]?\d{4})$",
    re.IGNORECASE,
)


def is_probable_month_column(name: str) -> bool:
    s = str(name).strip()
    if not s or s.lower().startswith("unnamed"):
        return False
    return bool(MONTH_COLUMN_PATTERN.search(s))


_HEADER_KEYWORD_FRAGMENTS: tuple[str, ...] = (
    "lokaliz",
    "wynajm",
    "kontakt",
    "telefon",
    "powierzchn",
    "uwag",
    "miasto",
    "email",
    "osoba",
    "status",
    "reklam",
    "najem",
    "wlasciciel",
    "wlascic",
    "adres",
    "numer",
    "umow",
    "nosnik",
    "nośnik",
    "format",
    "lp",
    "l.p",
    "r.p",
    "dziel",
    "czynsz",
    "kwota",
)


def _normalize_cell_for_header_score(value: Any) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    return str(value).strip().lower()


def _header_row_score(values: pd.Series) -> float:
    score = 0.0
    filled = 0
    for raw in values.tolist():
        s = _normalize_cell_for_header_score(raw)
        if not s:
            continue
        filled += 1
        matched_kw = False
        s_compact = s.replace(".", "").replace(" ", "")
        for kw in _HEADER_KEYWORD_FRAGMENTS:
            if kw in s or kw in s_compact:
                score += 4.0
                matched_kw = True
                break
        if not matched_kw and len(s) <= 48 and not re.match(r"^-?\d+([.,]\d+)?$", s.replace(" ", "")):
            score += 0.35
    if filled == 0:
        return -1.0
    numeric_ratio = sum(
        1
        for raw in values.tolist()
        if _normalize_cell_for_header_score(raw)
        and re.match(r"^-?\d+([.,]\d+)?$", _normalize_cell_for_header_score(raw).replace(" ", ""))
    ) / max(filled, 1)
    score -= numeric_ratio * 2.5
    return score


def guess_header_row_1based(
    file_name: str,
    file_content: bytes,
    *,
    sheet_name: str | int | None = None,
    skip_rows_before_header: int = 0,
    max_scan: int = 35,
) -> int:
    """Pick the most likely header row (1-based, original sheet row index)."""
    lower = file_name.lower()
    skip = max(0, skip_rows_before_header)
    skiprows: list[int] | None = list(range(skip)) if skip else None

    if lower.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(file_content), header=None, skiprows=skiprows, nrows=max_scan)
    elif lower.endswith((".xlsx", ".xls")):
        xf = pd.ExcelFile(io.BytesIO(file_content))
        sn: str | int = 0
        if sheet_name is not None and sheet_name != "":
            sn = sheet_name
        df = pd.read_excel(xf, sheet_name=sn, header=None, skiprows=skiprows, nrows=max_scan)
    else:
        return 1

    if len(df.index) == 0:
        return skip + 1

    best_rel = 0
    best_score = -1e9
    for rel in range(len(df.index)):
        row_score = _header_row_score(df.iloc[rel])
        if row_score > best_score:
            best_score = row_score
            best_rel = rel

    if best_score < 1.5:
        return skip + 1
    return skip + best_rel + 1


def list_excel_sheet_info(file_content: bytes, file_name: str) -> list[dict[str, Any]]:
    lower = file_name.lower()
    if not lower.endswith((".xlsx", ".xls")):
        return []
    xf = pd.ExcelFile(io.BytesIO(file_content))
    out: list[dict[str, Any]] = []
    for sheet in xf.sheet_names:
        try:
            df = pd.read_excel(xf, sheet_name=sheet, header=None, nrows=500)
            out.append(
                {
                    "name": sheet,
                    "row_count": int(len(df.index)),
                    "column_count": int(len(df.columns)),
                }
            )
        except Exception:  # noqa: BLE001
            out.append({"name": sheet, "row_count": 0, "column_count": 0})
    return out


def read_tabular_dataframe(
    file_name: str,
    file_content: bytes,
    *,
    sheet_name: str | int | None = None,
    header_row_1based: int = 1,
    skip_rows_before_header: int = 0,
) -> tuple[pd.DataFrame, int]:
    """header_row_1based: Excel row of header (1-based). Use 0 or negative for automatic detection.

    Returns the dataframe and the resolved 1-based header row index.
    """
    lower = file_name.lower()
    skip = max(0, skip_rows_before_header)
    resolved_header = header_row_1based
    if resolved_header < 1:
        resolved_header = guess_header_row_1based(
            file_name,
            file_content,
            sheet_name=sheet_name,
            skip_rows_before_header=skip,
        )
    header_zero = max(0, resolved_header - 1 - skip)
    skiprows: list[int] | None = list(range(skip)) if skip else None

    if lower.endswith(".csv"):
        df = pd.read_csv(
            io.BytesIO(file_content),
            header=header_zero,
            skiprows=skiprows,
        )
        return df, resolved_header

    if lower.endswith((".xlsx", ".xls")):
        kwargs: dict[str, Any] = {
            "io": io.BytesIO(file_content),
            "header": header_zero,
            "sheet_name": sheet_name if sheet_name is not None and sheet_name != "" else 0,
        }
        if skiprows is not None:
            kwargs["skiprows"] = skiprows
        df = pd.read_excel(**kwargs)
        return df, resolved_header

    raise ValueError("Unsupported file type. Allowed extensions: .csv, .xlsx, .xls")


_RAW_SUMMARY_TOKENS = frozenset(
    {
        "razem",
        "suma",
        "total",
        "ogółem",
        "ogolem",
        "podsumowanie",
        "grand total",
        "subtotal",
    }
)


def is_probable_summary_raw_row(raw_row: dict[str, Any]) -> bool:
    """Detect aggregate / blank lines before mapping to contracts."""
    non_null = 0
    for v in raw_row.values():
        if v is None or (isinstance(v, float) and pd.isna(v)):
            continue
        non_null += 1
        s = str(v).strip().lower()
        if s in _RAW_SUMMARY_TOKENS:
            return True
        if s.startswith("suma ") or s.startswith("razem ") or s.startswith("total "):
            return True
    return non_null == 0


MonthlyAgg = Literal["mean", "last", "sum_as_monthly"]


def collapse_wide_month_columns(
    df: pd.DataFrame,
    *,
    aggregate: MonthlyAgg = "mean",
) -> pd.DataFrame:
    """Collapse wide month columns into one row per contract with monthly_rent_net + total."""
    value_cols = [c for c in df.columns if is_probable_month_column(str(c))]
    if not value_cols:
        return df
    id_vars = [c for c in df.columns if c not in value_cols]
    if not id_vars:
        return df
    long = df.melt(id_vars=id_vars, value_vars=value_cols, var_name="__period", value_name="__amount")
    long["__amount"] = pd.to_numeric(long["__amount"], errors="coerce")
    long = long.dropna(subset=["__amount"])

    records: list[dict[str, Any]] = []
    for key_tuple, group in long.groupby(id_vars, dropna=False):
        s = group["__amount"].astype(float)
        total = float(s.sum())
        if aggregate == "last":
            mval = float(s.iloc[-1])
        elif aggregate == "sum_as_monthly":
            mval = total / max(len(s), 1)
        else:
            mval = float(s.mean())
        if len(id_vars) == 1:
            rec: dict[str, Any] = {id_vars[0]: key_tuple}
        else:
            rec = {k: v for k, v in zip(id_vars, key_tuple)}
        rec["monthly_rent_net"] = mval
        rec["total_contract_value_net"] = total
        records.append(rec)
    return pd.DataFrame(records)


_SUMMARY_MARKERS = frozenset(
    {
        "SUMA",
        "RAZEM",
        "TOTAL",
        "SUBTOTAL",
        "PODSUMOWANIE",
        "OGÓŁEM",
        "OGÓLEM",
        "GRAND TOTAL",
        "NETTO",
        "BRUTTO",
    }
)


def is_noise_import_row(normalized_payload: dict[str, Any]) -> bool:
    """Skip subtotal/header rows that look like aggregate lines (when klient is non-empty)."""
    adv = str(normalized_payload.get("advertiser_name") or "").strip()
    if not adv:
        return False
    up = adv.upper().strip()
    if up in _SUMMARY_MARKERS:
        return True
    if up.startswith("SUMA ") or up.startswith("RAZEM ") or up.startswith("TOTAL "):
        return True
    if len(up) <= 2 and up in {"—", "-", "…", ".."}:
        return True
    return False
