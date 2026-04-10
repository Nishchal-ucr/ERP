"""Move birds between sheds; optional flock metadata copy when destination is empty."""

from __future__ import annotations

from typing import Any

from db.connection import get_connection
from services.daily_reports_service import _now_iso, _recalculate_feed_item_daily_stock
from services.flock_placement_service import (
    ShedNotFoundError,
    _shed_is_empty,
    _today_yyyymmdd,
)
from utils.date_utils import parse_iso_date_to_yyyymmdd


def _get_latest_closing_birds(conn, shed_id: int) -> int | None:
    """Latest closingBirds for shed with reportDate <= today."""
    today_int = _today_yyyymmdd()
    row = conn.execute(
        """
        SELECT sdr.closingBirds
        FROM shed_daily_reports sdr
        JOIN daily_reports dr ON dr.id = sdr.dailyReportId
        WHERE sdr.shedId = %s AND dr.reportDate <= %s
        ORDER BY dr.reportDate DESC
        LIMIT 1
        """,
        (shed_id, today_int),
    ).fetchone()
    if row is None:
        return None
    v = row.get("closingBirds")
    if v is None:
        return None
    return int(v)


def _ensure_daily_report(conn, report_date_int: int, submitter_id: int) -> int:
    dr = conn.execute(
        "SELECT id FROM daily_reports WHERE reportDate = %s",
        (report_date_int,),
    ).fetchone()
    if dr:
        return int(dr["id"])
    cur = conn.execute(
        """
        INSERT INTO daily_reports (
          reportDate, createdByUserId, status, submittedAt, createdAt, updatedAt
        )
        VALUES (%s, %s, 'SUBMITTED', %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
        """,
        (report_date_int, submitter_id, _now_iso()),
    )
    return int(cur.fetchone()["id"])


def _upsert_shed_bird_line(
    conn,
    daily_report_id: int,
    shed_id: int,
    latest_snapshot: int,
    new_closing: int,
) -> None:
    """Set today's shed line opening/closing; preserve other columns if row exists."""
    existing = conn.execute(
        """
        SELECT id, openingBirds, closingBirds
        FROM shed_daily_reports
        WHERE dailyReportId = %s AND shedId = %s
        """,
        (daily_report_id, shed_id),
    ).fetchone()
    opening = latest_snapshot
    if existing:
        ob = existing.get("openingBirds")
        if ob is not None:
            opening = int(ob)
        conn.execute(
            """
            UPDATE shed_daily_reports
            SET
              openingBirds = %s,
              birdsMortality = COALESCE(birdsMortality, 0),
              closingBirds = %s,
              updatedAt = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (opening, new_closing, int(existing["id"])),
        )
        return
    conn.execute(
        """
        INSERT INTO shed_daily_reports (
          dailyReportId, shedId, openingBirds, birdsMortality, closingBirds,
          openingEggs, damagedEggs, standardEggsClosing, smallEggsClosing, bigEggsClosing,
          feedOpening, feedIssued, feedClosing, feedConsumed, totalEggsClosing, eggsProduced,
          totalFeedReceipt, closingFeed, createdAt, updatedAt
        ) VALUES (
          %s, %s, %s, 0, %s,
          0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0,
          0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        """,
        (daily_report_id, shed_id, opening, new_closing),
    )


def _clear_shed_flock_identity(conn, shed_id: int) -> None:
    conn.execute(
        "UPDATE sheds SET flockNumber = NULL, updatedAt = CURRENT_TIMESTAMP WHERE id = %s",
        (shed_id,),
    )
    conn.execute("DELETE FROM shed_flock_metadata WHERE shedId = %s", (shed_id,))


def _copy_flock_metadata_to_shed(
    conn, from_shed_id: int, to_shed_id: int
) -> tuple[str, str]:
    meta = conn.execute(
        "SELECT flockNumber, birthDate FROM shed_flock_metadata WHERE shedId = %s",
        (from_shed_id,),
    ).fetchone()
    shed_row = conn.execute(
        "SELECT flockNumber FROM sheds WHERE id = %s",
        (from_shed_id,),
    ).fetchone()
    fn = (meta.get("flockNumber") if meta else None) or (
        shed_row.get("flockNumber") if shed_row else None
    ) or ""
    bd = (meta.get("birthDate") if meta else None) or ""
    if not fn.strip():
        raise ValueError("Source shed has no flock ID to copy.")
    if not bd.strip():
        bd = "2000-01-01"
    conn.execute(
        """
        UPDATE sheds
        SET flockNumber = %s, updatedAt = CURRENT_TIMESTAMP
        WHERE id = %s
        """,
        (fn, to_shed_id),
    )
    conn.execute(
        """
        INSERT INTO shed_flock_metadata (shedId, flockNumber, birthDate, updatedAt)
        VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
        ON CONFLICT (shedId) DO UPDATE SET
          flockNumber = EXCLUDED.flockNumber,
          birthDate = EXCLUDED.birthDate,
          updatedAt = CURRENT_TIMESTAMP
        """,
        (to_shed_id, fn, bd),
    )
    return str(fn), str(bd)


def transfer_shed(payload: dict[str, Any]) -> dict[str, Any]:
    required = (
        "fromShedId",
        "toShedId",
        "reportDate",
        "submitterId",
        "transferMode",
    )
    for key in required:
        if key not in payload or payload[key] is None:
            raise ValueError(f"{key} is required")

    from_id = int(payload["fromShedId"])
    to_id = int(payload["toShedId"])
    if from_id == to_id:
        raise ValueError("Source and destination sheds must be different.")

    submitter_id = int(payload["submitterId"])
    report_date_int = parse_iso_date_to_yyyymmdd(str(payload["reportDate"]))
    mode = str(payload.get("transferMode") or "").strip().lower()
    if mode not in ("all", "count"):
        raise ValueError("transferMode must be 'all' or 'count'.")

    with get_connection() as conn:
        user = conn.execute(
            "SELECT id FROM users WHERE id = %s",
            (submitter_id,),
        ).fetchone()
        if not user:
            raise ValueError("Invalid submitterId")

        for sid, label in ((from_id, "source"), (to_id, "destination")):
            sh = conn.execute(
                "SELECT id, active FROM sheds WHERE id = %s",
                (sid,),
            ).fetchone()
            if not sh or not sh.get("active"):
                raise ShedNotFoundError()

        latest_from = _get_latest_closing_birds(conn, from_id)
        if latest_from is None or latest_from < 1:
            raise ValueError("No birds to transfer from the source shed.")

        if mode == "all":
            n = latest_from
        else:
            if payload.get("birdCount") is None:
                raise ValueError("birdCount is required when transferMode is count")
            n = int(payload["birdCount"])
            if n < 1:
                raise ValueError("birdCount must be a positive integer")
        if n > latest_from:
            raise ValueError("Cannot transfer more birds than available in the source shed.")

        to_empty = _shed_is_empty(conn, to_id)
        latest_to = _get_latest_closing_birds(conn, to_id)
        base_to = int(latest_to or 0)

        daily_report_id = _ensure_daily_report(conn, report_date_int, submitter_id)

        new_from_closing = latest_from - n
        new_to_closing = base_to + n

        _upsert_shed_bird_line(
            conn, daily_report_id, from_id, latest_from, new_from_closing
        )
        _upsert_shed_bird_line(
            conn, daily_report_id, to_id, base_to, new_to_closing
        )

        metadata_copied = False
        warning: str | None = None

        if to_empty:
            _copy_flock_metadata_to_shed(conn, from_id, to_id)
            metadata_copied = True
        else:
            warning = (
                "Destination shed already had birds; flock metadata was not copied. "
                "Bird counts were merged."
            )

        if new_from_closing == 0:
            _clear_shed_flock_identity(conn, from_id)

        _recalculate_feed_item_daily_stock(conn, daily_report_id, report_date_int)
        conn.commit()

    return {
        "fromShedId": from_id,
        "toShedId": to_id,
        "birdsTransferred": n,
        "fromClosingBirds": new_from_closing,
        "toClosingBirds": new_to_closing,
        "reportDate": report_date_int,
        "metadataCopied": metadata_copied,
        "warning": warning,
    }
