from datetime import date

from app.services.import_guesser import parse_date


def test_parse_date_rejects_zero_and_small_integers() -> None:
    assert parse_date(0) is None
    assert parse_date(0.0) is None
    assert parse_date(1) is None
    assert parse_date(42) is None
    assert parse_date(1000) is None


def test_parse_date_excel_serial() -> None:
    d = parse_date(45000)
    assert d is not None
    assert d.year == 2023
    assert d.month == 3


def test_parse_date_polish_string() -> None:
    assert parse_date("15.03.2023") == date(2023, 3, 15)


def test_parse_date_empty_string() -> None:
    assert parse_date("") is None
    assert parse_date("   ") is None


def test_parse_date_polish_na_lata_od() -> None:
    assert parse_date("umowa na dwa lata od 16.06.2025") == date(2027, 6, 16)
    assert parse_date("Na 3 lata od 01.01.2024") == date(2027, 1, 1)
    assert parse_date("na rok od 15.03.2025") == date(2026, 3, 15)


def test_parse_date_multiline_range() -> None:
    assert parse_date("14.04.2026\n-09.09.2027") == date(2027, 9, 9)
    assert parse_date("14.04.2026-\n01.12.2027") == date(2027, 12, 1)
    assert parse_date("14.04.2026 - 09.09.2027") == date(2027, 9, 9)


def test_parse_date_open_ended_term_keyword() -> None:
    assert parse_date("umowa na czas nieokreślony") is None
    assert parse_date("UMOWA NA CZAS NIEOKRESLONY") is None


def test_parse_date_open_ended_term_keyword_multiline() -> None:
    assert parse_date("umowa na czas\nnieokreślony, bez terminu końca") is None
