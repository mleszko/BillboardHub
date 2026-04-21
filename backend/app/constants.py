"""Shared domain constants (import, API)."""

from datetime import date

# Stored when the spreadsheet has no real end date — NOT NULL in DB, but UI treats as unknown.
PLACEHOLDER_CONTRACT_EXPIRY: date = date(2099, 12, 31)
