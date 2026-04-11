"""Place a new flock on an empty shed: metadata, shed row, and today's shed_daily_reports line."""

from __future__ import annotations

from datetime import date
from typing import Any

from db.connection import get_connection
from services.daily_reports_service import _now_iso, _recalculate_feed_item_daily_stock
from utils.date_utils import parse_iso_date_to_yyyymmdd


class ShedNotFoundError(Exception):
    """Shed missing or inactive."""


def _today_yyyymmdd() -> int:
    d = date.today()
    return int(f"{d.year}{d.month:02d}{d.day:02d}")


def _shed_is_empty(conn, shed_id: int) -> bool:
    """True only if there is no shed_daily_reports row for this shed up to today, or latest closingBirds is 0."""
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
        return True
    v = row.get("closingBirds")
    if v is None:
        # Row exists but count not set — treat as not empty so we do not double-place.
        return False
    return int(v) == 0


def _normalize_birth_date(iso: str) -> str:
    yyyymmdd = parse_iso_date_to_yyyymmdd(iso)
    s = str(yyyymmdd)
    return f"{s[0:4]}-{s[4:6]}-{s[6:8]}"


def _ensure_flock_number_unique(conn, exclude_shed_id: int, flock_number: str) -> None:
    """Raise ValueError if another active shed already uses this flock ID (case-insensitive)."""
    fn = (flock_number or "").strip()
    if not fn:
        return
    dup = conn.execute(
        """
        SELECT 1 FROM (
          SELECT id AS sid FROM sheds
          WHERE id != %s AND active = 1
            AND TRIM(COALESCE(flockNumber, '')) != ''
            AND LOWER(TRIM(flockNumber)) = LOWER(%s)
          UNION
          SELECT m.shedId AS sid FROM shed_flock_metadata m
          INNER JOIN sheds s ON s.id = m.shedId AND s.active = 1
          WHERE m.shedId != %s
            AND LOWER(TRIM(m.flockNumber)) = LOWER(%s)
        ) d
        LIMIT 1
        """,
        (exclude_shed_id, fn, exclude_shed_id, fn),
    ).fetchone()
    if dup:
        raise ValueError("This flock ID is already used by another shed.")


def place_new_batch(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Validate shed is empty (latest closing birds null or 0), then update sheds,
    upsert shed_flock_metadata, ensure daily_reports for reportDate, upsert
    shed_daily_reports for this shed, recalc feed_item_daily_stock.
    """
    required = (
        "shedId",
        "flockNumber",
        "birthDate",
        "birdCount",
        "reportDate",
        "submitterId",
    )
    for key in required:
        if key not in payload or payload[key] is None:
            raise ValueError(f"{key} is required")

    shed_id = int(payload["shedId"])
    submitter_id = int(payload["submitterId"])
    flock_number = (payload.get("flockNumber") or "").strip()
    if not flock_number:
        raise ValueError("flockNumber is required")
    bird_count = int(payload["birdCount"])
    if bird_count <= 0:
        raise ValueError("birdCount must be a positive integer")

    birth_date_str = _normalize_birth_date(str(payload["birthDate"]))
    report_date_int = parse_iso_date_to_yyyymmdd(str(payload["reportDate"]))

    with get_connection() as conn:
        user = conn.execute(
            "SELECT id FROM users WHERE id = %s",
            (submitter_id,),
        ).fetchone()
        if not user:
            raise ValueError("Invalid submitterId")

        if not _shed_is_empty(conn, shed_id):
            raise ValueError("Shed is not empty.")

        shed = conn.execute(
            "SELECT id, active FROM sheds WHERE id = %s",
            (shed_id,),
        ).fetchone()
        if not shed or not shed.get("active"):
            raise ShedNotFoundError()

        _ensure_flock_number_unique(conn, shed_id, flock_number)

        conn.execute(
            """
            UPDATE sheds
            SET flockNumber = %s, updatedAt = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (flock_number, shed_id),
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
            (shed_id, flock_number, birth_date_str),
        )

        dr = conn.execute(
            "SELECT id FROM daily_reports WHERE reportDate = %s",
            (report_date_int,),
        ).fetchone()
        if dr:
            daily_report_id = int(dr["id"])
        else:
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
            daily_report_id = int(cur.fetchone()["id"])

        existing_sdr = conn.execute(
            """
            SELECT id FROM shed_daily_reports
            WHERE dailyReportId = %s AND shedId = %s
            """,
            (daily_report_id, shed_id),
        ).fetchone()

        if existing_sdr:
            # Only update bird columns so an existing partial day entry is not wiped.
            conn.execute(
                """
                UPDATE shed_daily_reports
                SET
                  openingBirds = %s,
                  birdsMortality = 0,
                  closingBirds = %s,
                  updatedAt = CURRENT_TIMESTAMP
                WHERE id = %s
                """,
                (bird_count, bird_count, int(existing_sdr["id"])),
            )
        else:
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
                (daily_report_id, shed_id, bird_count, bird_count),
            )

        _recalculate_feed_item_daily_stock(conn, daily_report_id, report_date_int)
        conn.commit()

    return {
        "shedId": shed_id,
        "flockNumber": flock_number,
        "birthDate": birth_date_str,
        "birdCount": bird_count,
        "reportDate": report_date_int,
    }
