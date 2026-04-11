from datetime import datetime, timedelta


def parse_iso_date_to_yyyymmdd(date_string: str) -> int:
    try:
        dt = datetime.fromisoformat(date_string)
    except ValueError as exc:
        raise ValueError(f"Invalid date format: {date_string}") from exc
    return int(f"{dt.year}{dt.month:02d}{dt.day:02d}")


def yyyymmdd_add_days(yyyymmdd: int, days: int) -> int:
    """Add calendar days to a YYYYMMDD integer date."""
    s = str(int(yyyymmdd)).zfill(8)
    dt = datetime(int(s[0:4]), int(s[4:6]), int(s[6:8]))
    dt2 = dt + timedelta(days=days)
    return int(f"{dt2.year}{dt2.month:02d}{dt2.day:02d}")
