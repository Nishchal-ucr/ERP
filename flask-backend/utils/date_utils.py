from datetime import datetime


def parse_iso_date_to_yyyymmdd(date_string: str) -> int:
    try:
        dt = datetime.fromisoformat(date_string)
    except ValueError as exc:
        raise ValueError(f"Invalid date format: {date_string}") from exc
    return int(f"{dt.year}{dt.month:02d}{dt.day:02d}")
