"""Reduce bird count for a shed (cull / live sale); clear flock identity when count hits zero."""

from __future__ import annotations

from typing import Any

from db.connection import get_connection
from services.daily_reports_service import _recalculate_feed_item_daily_stock
from services.flock_placement_service import ShedNotFoundError
from services.shed_transfer_service import (
    _clear_shed_flock_identity,
    _ensure_daily_report,
    _get_latest_closing_birds,
    _upsert_shed_bird_line,
)
from utils.date_utils import parse_iso_date_to_yyyymmdd


def cull_bird_sales(payload: dict[str, Any]) -> dict[str, Any]:
    required = ("shedId", "reportDate", "submitterId", "mode")
    for key in required:
        if key not in payload or payload[key] is None:
            raise ValueError(f"{key} is required")

    shed_id = int(payload["shedId"])
    submitter_id = int(payload["submitterId"])
    report_date_int = parse_iso_date_to_yyyymmdd(str(payload["reportDate"]))
    mode = str(payload.get("mode") or "").strip().lower()
    if mode not in ("all", "count"):
        raise ValueError("mode must be 'all' or 'count'.")

    with get_connection() as conn:
        user = conn.execute(
            "SELECT id FROM users WHERE id = %s",
            (submitter_id,),
        ).fetchone()
        if not user:
            raise ValueError("Invalid submitterId")

        shed = conn.execute(
            "SELECT id, active FROM sheds WHERE id = %s",
            (shed_id,),
        ).fetchone()
        if not shed or not shed.get("active"):
            raise ShedNotFoundError()

        latest = _get_latest_closing_birds(conn, shed_id)
        if latest is None or latest < 1:
            raise ValueError("No birds to remove from this shed.")

        if mode == "all":
            n = latest
        else:
            if payload.get("birdCount") is None:
                raise ValueError("birdCount is required when mode is count")
            n = int(payload["birdCount"])
            if n < 1:
                raise ValueError("birdCount must be a positive integer")
            if n > latest:
                raise ValueError("Cannot remove more birds than are in the shed.")

        new_closing = latest - n
        daily_report_id = _ensure_daily_report(conn, report_date_int, submitter_id)

        _upsert_shed_bird_line(
            conn, daily_report_id, shed_id, latest, new_closing
        )

        flock_cleared = new_closing == 0
        if flock_cleared:
            _clear_shed_flock_identity(conn, shed_id)

        _recalculate_feed_item_daily_stock(conn, daily_report_id, report_date_int)
        conn.commit()

    return {
        "shedId": shed_id,
        "birdsRemoved": n,
        "newClosingBirds": new_closing,
        "reportDate": report_date_int,
        "flockCleared": flock_cleared,
    }
