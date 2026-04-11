"""Correct shed closing birds/eggs/feed for a past report date; sync next-day openings when present."""

from __future__ import annotations

from typing import Any

from db.connection import get_connection
from utils.date_utils import parse_iso_date_to_yyyymmdd, yyyymmdd_add_days


def _sold_eggs_and_loading_damage_for_shed(
    conn, daily_report_id: int, shed_id: int
) -> tuple[int, int]:
    row = conn.execute(
        """
        SELECT
          COALESCE(SUM(si.standardEggs + si.smallEggs + si.bigEggs), 0) AS sold_eggs,
          COALESCE(SUM(si.loadingDamage), 0) AS loading_damage
        FROM sale_items si
        INNER JOIN sales s ON s.id = si.saleId
        WHERE s.dailyReportId = %s AND si.shedId = %s
        """,
        (daily_report_id, shed_id),
    ).fetchone()
    if not row:
        return 0, 0
    return int(row["sold_eggs"] or 0), int(row["loading_damage"] or 0)


def _total_eggs_closing_from_row(row: dict) -> int:
    total = row.get("totalEggsClosing")
    if total is not None:
        return int(total)
    return (
        int(row.get("standardEggsClosing") or 0)
        + int(row.get("smallEggsClosing") or 0)
        + int(row.get("bigEggsClosing") or 0)
    )


def apply_shed_closing_override(
    payload: dict[str, Any],
) -> tuple[dict[str, Any] | None, str | None]:
    required = (
        "reportDate",
        "shedId",
        "submitterId",
        "closingBirds",
        "standardEggsClosing",
        "smallEggsClosing",
        "bigEggsClosing",
        "feedClosing",
    )
    for key in required:
        if key not in payload or payload[key] is None:
            raise ValueError(f"{key} is required")

    shed_id = int(payload["shedId"])
    submitter_id = int(payload["submitterId"])
    closing_birds = int(payload["closingBirds"])
    std_eggs = int(payload["standardEggsClosing"])
    small_eggs = int(payload["smallEggsClosing"])
    big_eggs = int(payload["bigEggsClosing"])
    feed_closing = float(payload["feedClosing"])

    if closing_birds < 0 or std_eggs < 0 or small_eggs < 0 or big_eggs < 0:
        raise ValueError("Bird and egg counts cannot be negative.")
    if feed_closing < 0:
        raise ValueError("feedClosing cannot be negative.")

    report_date_int = parse_iso_date_to_yyyymmdd(str(payload["reportDate"]))
    total_eggs = std_eggs + small_eggs + big_eggs

    with get_connection() as conn:
        user = conn.execute(
            "SELECT id FROM users WHERE id = %s",
            (submitter_id,),
        ).fetchone()
        if not user:
            raise ValueError("Invalid submitterId")

        report = conn.execute(
            "SELECT id FROM daily_reports WHERE reportDate = %s",
            (report_date_int,),
        ).fetchone()
        if not report:
            return None, "not_found"

        daily_report_id = int(report["id"])
        sdr = conn.execute(
            """
            SELECT id, dailyReportId, shedId, feedIssued
            FROM shed_daily_reports
            WHERE dailyReportId = %s AND shedId = %s
            """,
            (daily_report_id, shed_id),
        ).fetchone()
        if not sdr:
            return None, "no_shed_line"

        conn.execute(
            """
            UPDATE shed_daily_reports
            SET
              closingBirds = %s,
              standardEggsClosing = %s,
              smallEggsClosing = %s,
              bigEggsClosing = %s,
              totalEggsClosing = %s,
              feedClosing = %s,
              closingFeed = %s,
              updatedAt = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (
                closing_birds,
                std_eggs,
                small_eggs,
                big_eggs,
                total_eggs,
                feed_closing,
                feed_closing,
                int(sdr["id"]),
            ),
        )

        next_day_adjusted = False
        next_sdr_id: int | None = None

        next_report_date = yyyymmdd_add_days(report_date_int, 1)
        next_report = conn.execute(
            "SELECT id FROM daily_reports WHERE reportDate = %s",
            (next_report_date,),
        ).fetchone()
        if next_report:
            next_dr_id = int(next_report["id"])
            next_row = conn.execute(
                """
                SELECT *
                FROM shed_daily_reports
                WHERE dailyReportId = %s AND shedId = %s
                """,
                (next_dr_id, shed_id),
            ).fetchone()
            if next_row:
                next_sdr_id = int(next_row["id"])
                opening_birds = closing_birds
                opening_eggs = total_eggs
                feed_opening = feed_closing

                total_close_next = _total_eggs_closing_from_row(dict(next_row))
                sold_eggs, loading_damage = _sold_eggs_and_loading_damage_for_shed(
                    conn, next_dr_id, shed_id
                )
                eggs_produced = float(
                    total_close_next - opening_eggs + sold_eggs + loading_damage
                )

                feed_issued = float(next_row.get("feedIssued") or 0)
                feed_close_next = float(
                    next_row.get("feedClosing")
                    if next_row.get("feedClosing") is not None
                    else next_row.get("closingFeed")
                    or 0
                )
                feed_consumed = feed_opening - feed_close_next + feed_issued

                conn.execute(
                    """
                    UPDATE shed_daily_reports
                    SET
                      openingBirds = %s,
                      openingEggs = %s,
                      feedOpening = %s,
                      eggsProduced = %s,
                      feedConsumed = %s,
                      updatedAt = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (
                        opening_birds,
                        opening_eggs,
                        feed_opening,
                        eggs_produced,
                        feed_consumed,
                        next_sdr_id,
                    ),
                )
                next_day_adjusted = True

        conn.commit()

    out = {
        "shedDailyReportId": int(sdr["id"]),
        "reportDate": report_date_int,
        "shedId": shed_id,
        "closingBirds": closing_birds,
        "standardEggsClosing": std_eggs,
        "smallEggsClosing": small_eggs,
        "bigEggsClosing": big_eggs,
        "totalEggsClosing": total_eggs,
        "feedClosing": feed_closing,
        "nextDayAdjusted": next_day_adjusted,
        "nextShedDailyReportId": next_sdr_id,
    }
    return out, None
