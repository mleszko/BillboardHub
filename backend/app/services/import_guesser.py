from __future__ import annotations

import io
import json
import re
import unicodedata
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any

import pandas as pd
from fastapi import UploadFile
from openai import OpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.models import ImportColumnMapping, ImportSession, ImportStatus
from app.schemas.imports import (
    CANONICAL_FIELDS,
    ImportMappingProposalResponse,
    MappingGuessesResponse,
    MappingProposal,
    REQUIRED_IMPORT_FIELDS,
)

DEFAULT_HEADER_HINTS: dict[str, list[tuple[str, float]]] = {
    "lokalizacja": [("location_address", 0.93)],
    "l_p": [("contract_number", 0.88)],
    "lp": [("contract_number", 0.82)],
    "data_wygasniecia": [("expiry_date", 0.95), ("start_date", 0.2)],
    "koniec": [("expiry_date", 0.9)],
    "wygasa": [("expiry_date", 0.86)],
    "data_rozpoczecia": [("start_date", 0.88)],
    "start": [("start_date", 0.78)],
    "reklamodawca": [("advertiser_name", 0.95)],
    "najemca": [("advertiser_name", 0.84)],
    "wlasciciel": [("property_owner_name", 0.88)],
    "wynajmujacy": [("property_owner_name", 0.9)],
    "wynajmujaca": [("property_owner_name", 0.88)],
    "powierzchnia": [("surface_size", 0.9)],
    "rozmiar": [("surface_size", 0.82)],
    "format": [("surface_size", 0.55)],
    "osoba_kontaktowa": [("contact_person", 0.92)],
    "kontakt": [("contact_person", 0.65)],
    "telefon": [("contact_phone", 0.9)],
    "tel": [("contact_phone", 0.85)],
    "email": [("contact_email", 0.92)],
    "mail": [("contact_email", 0.88)],
    "wartosc_umowy": [("total_contract_value_net", 0.88)],
    "koszt_calkowity": [("total_contract_value_net", 0.86)],
    "suma_umowy": [("total_contract_value_net", 0.84)],
    "adres": [("location_address", 0.85)],
    "miasto": [("city", 0.9)],
    "miejscowosc": [("city", 0.8)],
    "nr_umowy": [("contract_number", 0.9)],
    "numer_umowy": [("contract_number", 0.9)],
    "nosnik": [("billboard_code", 0.82), ("billboard_type", 0.5)],
    "typ": [("billboard_type", 0.8)],
    "czynsz_netto": [("monthly_rent_net", 0.92)],
    "czynsz_brutto": [("monthly_rent_gross", 0.92)],
    "vat": [("vat_rate", 0.9)],
    "waluta": [("currency", 0.9)],
    "uwagi": [("notes", 0.82)],
    "szerokosc_geo": [("latitude", 0.82)],
    "dlugosc_geo": [("longitude", 0.82)],
    # „Czas trwania umowy” — często zakres DD.MM.YYYY–DD.MM.YYYY lub „na X lat od …”
    "czas_trwania_umowy": [("expiry_date", 0.92), ("start_date", 0.35)],
    "okres_umowy": [("expiry_date", 0.88)],
    "czas_obowiazywania": [("expiry_date", 0.9)],
    "obowiazuje_do": [("expiry_date", 0.93)],
}


def _normalize_header(header: str) -> str:
    cleaned = header.strip().lower()
    cleaned = cleaned.replace("ł", "l").replace("ą", "a").replace("ć", "c")
    cleaned = cleaned.replace("ę", "e").replace("ń", "n").replace("ó", "o")
    cleaned = cleaned.replace("ś", "s").replace("ż", "z").replace("ź", "z")
    cleaned = re.sub(r"[^a-z0-9]+", "_", cleaned).strip("_")
    return cleaned


def _fallback_guess(columns: list[str]) -> list[MappingProposal]:
    proposals: list[MappingProposal] = []
    for column in columns:
        normalized = _normalize_header(column)
        hints = DEFAULT_HEADER_HINTS.get(normalized, [])
        if hints:
            target, confidence = hints[0]
            rationale = f"Matched normalized Polish header '{normalized}'."
        else:
            target = None
            confidence = 0.2
            rationale = "No confident heuristic match found."
        proposals.append(
            MappingProposal(
                source_column_name=column,
                target_field_name=target,
                guessed_confidence=confidence,
                guessed_rationale=rationale,
                transform_hint=None,
                is_required_target=bool(target and target in REQUIRED_IMPORT_FIELDS),
            )
        )
    return proposals


def heuristic_mapping_proposals(columns: list[str]) -> list[MappingProposal]:
    """Polish header heuristics only — no external API calls."""
    return _fallback_guess(columns)


def _build_prompt(columns: list[str], sample_rows: list[dict[str, Any]]) -> str:
    payload = {
        "task": (
            "Map source columns from a Polish billboard contracts spreadsheet to target schema fields. "
            "Return strict JSON object with key 'proposals' only."
        ),
        "columns": columns,
        "sample_rows": sample_rows[:2],
        "target_fields": CANONICAL_FIELDS,
        "required_fields": sorted(REQUIRED_IMPORT_FIELDS),
        "response_format": {
            "proposals": [
                {
                    "source_column_name": "string",
                    "target_field_name": "string or null",
                    "guessed_confidence": "float 0..1",
                    "guessed_rationale": "short rationale",
                    "transform_hint": "string or null",
                    "is_required_target": "boolean",
                }
            ]
        },
    }
    return json.dumps(payload, ensure_ascii=True)


def _parse_llm_mapping(raw_content: str) -> list[MappingProposal]:
    data = json.loads(raw_content)
    return [MappingProposal(**item) for item in data.get("proposals", [])]


def _fold_ascii_lower(s: str) -> str:
    """Lowercase + strip Polish accents for simple keyword matching."""
    nfkd = unicodedata.normalize("NFD", s)
    stripped = "".join(c for c in nfkd if unicodedata.category(c) != "Mn")
    return stripped.lower()


# „na dwa lata od 16.06.2025” → data końca (+N lat od startu)
_WORD_YEARS: dict[str, int] = {
    "jeden": 1,
    "jednego": 1,
    "dwa": 2,
    "dwoch": 2,
    "trzy": 3,
    "cztery": 4,
    "piec": 5,
    "szesc": 6,
    "siedem": 7,
    "osiem": 8,
    "dziewiec": 9,
    "dziesiec": 10,
}


def _add_calendar_years(d: date, years: int) -> date:
    try:
        return d.replace(year=d.year + years)
    except ValueError:
        return date(d.year + years, d.month, 28)


def _parse_na_lata_od(text: str) -> date | None:
    """Parse Polish phrases like „umowa na dwa lata od 16.06.2025”."""
    m_od = re.search(r"\bod\s+(\d{1,2})\.(\d{1,2})\.(\d{4})\b", text, re.IGNORECASE)
    if not m_od:
        return None
    try:
        start = date(int(m_od.group(3)), int(m_od.group(2)), int(m_od.group(1)))
    except ValueError:
        return None
    prefix = text[: m_od.start()]
    folded = _fold_ascii_lower(prefix)
    years: int | None = None
    m_num = re.search(r"na\s+(\d{1,2})\s+(?:lat|lata|latach|rok|roku)\b", folded)
    if m_num:
        years = int(m_num.group(1))
    else:
        m_w = re.search(r"na\s+([a-z]+)\s+(?:lata|lat|rok|roku)\b", folded)
        if m_w:
            years = _WORD_YEARS.get(m_w.group(1))
        if years is None and re.search(r"\bna\s+rok\b", folded):
            years = 1
    if years is None or not (1 <= years <= 40):
        return None
    return _add_calendar_years(start, years)


_DMY_RE = re.compile(r"\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b")


def _collect_dmy_dates(text: str) -> list[date]:
    """All DD.MM.YYYY (or YY) in a cell; newlines and stray hyphens tolerated."""
    flat = re.sub(r"[\r\n]+", " ", text)
    flat = re.sub(r"\s+", " ", flat).strip()
    out: list[date] = []
    for m in _DMY_RE.finditer(flat):
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if y < 100:
            y += 2000 if y < 70 else 1900
        try:
            out.append(date(y, mo, d))
        except ValueError:
            continue
    return out


def _parse_polish_duration_or_range(text: str) -> date | None:
    """
    Expiry heuristics for „czas trwania umowy” style cells:
    - natural language + start date
    - two (or more) calendar dates → latest as end of contract
    """
    if not text or not str(text).strip():
        return None
    s = str(text).strip()
    d1 = _parse_na_lata_od(s)
    if d1:
        return d1
    dates = _collect_dmy_dates(s)
    if len(dates) >= 2:
        return max(dates)
    return None


def parse_decimal(value: Any) -> Decimal | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, Decimal):
        return value
    text = str(value).strip().replace(" ", "").replace(",", ".")
    if not text:
        return None
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def parse_date(value: Any) -> date | None:
    """Parse dates from Excel/CSV. Guards against row indices (1,2,…) and 0 mapping to Unix epoch (1970-01-01)."""
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        if pd.isna(value):
            return None
        return value.date()
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        x = float(value)
        if pd.isna(x) or abs(x) < 1e-12:
            return None
        xi = int(x) if x == int(x) else None
        # l.p. / row counters; pd.to_datetime(0) and small ints → 1970-01-01 garbage
        if xi is not None and 0 <= xi <= 1000:
            return None

        if 200 <= x <= 1_000_000:
            try:
                from openpyxl.utils.datetime import from_excel

                dt = from_excel(x)
                cand = dt.date() if isinstance(dt, datetime) else dt
                if isinstance(cand, date) and cand.year >= 1980:
                    return cand
            except (TypeError, ValueError, OverflowError):
                pass
            try:
                base = date(1899, 12, 30)
                cand = base + timedelta(days=int(round(x)))
                if cand.year >= 1980:
                    return cand
            except (TypeError, ValueError, OverflowError):
                pass

        if x > 1e12:
            parsed = pd.to_datetime(x, unit="ms", errors="coerce", utc=True)
        elif x > 1e9:
            parsed = pd.to_datetime(x, unit="s", errors="coerce", utc=True)
        else:
            return None
        if pd.isna(parsed):
            return None
        return parsed.date()

    s = str(value).strip()
    if not s or s in {"0", "-", "—", "?", "…", ".."}:
        return None
    parsed = pd.to_datetime(s, errors="coerce", dayfirst=True)
    if pd.isna(parsed):
        pl = _parse_polish_duration_or_range(s)
        return pl
    return parsed.date()


def read_dataframe(filename: str, content: bytes) -> pd.DataFrame:
    if filename.lower().endswith(".csv"):
        return pd.read_csv(io.BytesIO(content))
    if filename.lower().endswith(".xlsx"):
        return pd.read_excel(io.BytesIO(content))
    raise ValueError("Unsupported file type. Allowed: .csv, .xlsx")


def sample_payload(df: pd.DataFrame) -> tuple[list[str], list[dict[str, Any]]]:
    columns = [str(c) for c in df.columns.tolist()]
    sampled = df.head(2).fillna("").to_dict(orient="records")
    return columns, sampled


def guess_mapping_with_llm(columns: list[str], sample_rows: list[dict[str, Any]]) -> MappingGuessesResponse:
    settings = get_settings()
    fallback = _fallback_guess(columns)
    if not settings.openai_api_key:
        return MappingGuessesResponse(
            proposals=fallback,
            guessed_by_model="heuristic-fallback",
            prompt_version="v1",
            warning="OPENAI_API_KEY missing, used deterministic fallback matcher.",
        )

    try:
        client = OpenAI(api_key=settings.openai_api_key)
        prompt = _build_prompt(columns, sample_rows)
        completion = client.chat.completions.create(
            model=settings.openai_model,
            response_format={"type": "json_object"},
            temperature=0.1,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a data mapping assistant for Polish billboard contract spreadsheets. "
                        "Always return strict JSON."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
        )
        content = completion.choices[0].message.content or '{"proposals":[]}'
        parsed = _parse_llm_mapping(content)
        if not parsed:
            parsed = fallback
            warning = "Model returned empty proposals; fallback used."
        else:
            warning = None
        return MappingGuessesResponse(
            proposals=parsed,
            guessed_by_model=settings.openai_model,
            prompt_version="v1",
            warning=warning,
        )
    except Exception as exc:  # noqa: BLE001
        return MappingGuessesResponse(
            proposals=fallback,
            guessed_by_model="heuristic-fallback",
            prompt_version="v1",
            warning=f"LLM guess failed, fallback used: {exc}",
        )


def mapping_to_db_rows(
    session: ImportSession, owner_user_id: str, response: MappingGuessesResponse
) -> list[ImportColumnMapping]:
    mappings: list[ImportColumnMapping] = []
    for proposal in response.proposals:
        mappings.append(
            ImportColumnMapping(
                import_session_id=session.id,
                owner_user_id=owner_user_id,
                source_column_name=proposal.source_column_name,
                target_field_name=proposal.target_field_name,
                guessed_confidence=proposal.guessed_confidence,
                guessed_rationale=proposal.guessed_rationale,
                transform_hint=proposal.transform_hint,
                is_required_target=proposal.is_required_target,
                confirmed_by_user=False,
                user_override=False,
            )
        )
    session.status = ImportStatus.mapped
    session.llm_model = response.guessed_by_model
    session.llm_prompt_version = response.prompt_version
    return mappings


async def generate_mapping_proposal(
    db: AsyncSession, user_id: str, file: UploadFile
) -> ImportMappingProposalResponse:
    raw_content = await file.read()
    if not raw_content:
        raise ValueError("Uploaded file is empty.")

    file_name = file.filename or "uploaded-file"
    df = read_dataframe(file_name, raw_content)
    columns, sample_rows = sample_payload(df)
    guesses = guess_mapping_with_llm(columns, sample_rows)

    import_session = ImportSession(
        owner_user_id=user_id,
        original_file_name=file_name,
        file_type=("xlsx" if file_name.lower().endswith(".xlsx") else "csv"),
        status=ImportStatus.mapped,
        total_rows=int(len(df.index)),
        llm_model=guesses.guessed_by_model,
        llm_prompt_version=guesses.prompt_version,
    )
    db.add(import_session)
    await db.flush()

    mappings = mapping_to_db_rows(import_session, user_id, guesses)
    db.add_all(mappings)

    session_data = {
        "columns": columns,
        "sample_rows": sample_rows,
        "all_rows": df.fillna("").to_dict(orient="records"),
    }
    import_session.storage_path = json.dumps(session_data, ensure_ascii=False)
    await db.commit()

    return ImportMappingProposalResponse(
        session_id=import_session.id,
        owner_user_id=user_id,
        file_name=import_session.original_file_name,
        total_rows=import_session.total_rows,
        columns=columns,
        mapping_suggestions=guesses.proposals,
        guessed_by_model=guesses.guessed_by_model,
        warning=guesses.warning,
    )

