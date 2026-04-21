"""Header fingerprints for known workbook templates (no client filenames in repo)."""

from __future__ import annotations

import hashlib
import re


def normalize_header_token(header: str) -> str:
    """Same rules as import_guesser._normalize_header (keep in sync)."""
    cleaned = str(header).strip().lower()
    cleaned = cleaned.replace("ł", "l").replace("ą", "a").replace("ć", "c")
    cleaned = cleaned.replace("ę", "e").replace("ń", "n").replace("ó", "o")
    cleaned = cleaned.replace("ś", "s").replace("ż", "z").replace("ź", "z")
    cleaned = re.sub(r"[^a-z0-9]+", "_", cleaned).strip("_")
    return cleaned


def header_fingerprint_from_column_names(columns: list[object]) -> str:
    """
    Stable hash of the header row as pandas/openpyxl expose it.
    Unnamed placeholders collapse to '_' so merged headers still match.
    """
    parts: list[str] = []
    for c in columns:
        s = str(c).strip()
        if s.startswith("Unnamed"):
            parts.append("_")
        else:
            parts.append(normalize_header_token(s))
    payload = "|".join(parts).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()[:32]
