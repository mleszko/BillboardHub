"""Pluggable import adapters for known spreadsheet layouts."""

from app.services.import_adapters.registry import try_known_adapter

__all__ = ["try_known_adapter"]
