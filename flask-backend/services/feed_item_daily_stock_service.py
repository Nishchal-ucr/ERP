"""Read and patch farm-wide feed item daily stock (latest snapshot)."""

from __future__ import annotations

from typing import Any

from db.connection import get_connection


def get_latest_feed_item_daily_stock_snapshot() -> dict[str, Any]:
    with get_connection() as conn:
        max_row = conn.execute(
            "SELECT MAX(reportDate) AS maxDate FROM feed_item_daily_stock"
        ).fetchone()
        max_date = max_row["maxDate"] if max_row else None
        if max_date is None:
            return {"reportDate": None, "items": []}

        report_date = int(max_date)
        rows = conn.execute(
            """
            SELECT
              fi.id AS feedItemId,
              fi.name,
              fi.category,
              COALESCE(s.openingKg, 0) AS openingKg,
              COALESCE(s.receiptsKg, 0) AS receiptsKg,
              COALESCE(s.usedKg, 0) AS usedKg,
              COALESCE(s.closingKg, 0) AS closingKg,
              s.manualClosingKg AS manualClosingKg
            FROM feed_items fi
            LEFT JOIN feed_item_daily_stock s
              ON s.feedItemId = fi.id AND s.reportDate = %s
            ORDER BY fi.name
            """,
            (report_date,),
        ).fetchall()

        items = []
        for row in rows:
            items.append(
                {
                    "feedItemId": int(row["feedItemId"]),
                    "name": str(row["name"]),
                    "category": str(row["category"]),
                    "openingKg": float(row["openingKg"] or 0),
                    "receiptsKg": float(row["receiptsKg"] or 0),
                    "usedKg": float(row["usedKg"] or 0),
                    "closingKg": float(row["closingKg"] or 0),
                    "manualClosingKg": float(row["manualClosingKg"])
                    if row["manualClosingKg"] is not None
                    else None,
                }
            )

        return {"reportDate": report_date, "items": items}


def patch_feed_item_daily_stock(
    report_date: int,
    items: list[dict[str, Any]],
) -> dict[str, Any]:
    """Apply manual closing overrides for the latest snapshot date only."""
    if not items:
        raise ValueError("items must not be empty")
    if not any("closingKg" in e for e in items):
        raise ValueError("Each item must include closingKg")

    with get_connection() as conn:
        max_row = conn.execute(
            "SELECT MAX(reportDate) AS maxDate FROM feed_item_daily_stock"
        ).fetchone()
        max_date = max_row["maxDate"] if max_row else None
        if max_date is None:
            raise ValueError("No feed stock data exists yet.")
        if int(max_date) != int(report_date):
            raise ValueError(
                "reportDate must match the latest feed stock snapshot date."
            )

        dr = conn.execute(
            "SELECT id FROM daily_reports WHERE reportDate = %s",
            (report_date,),
        ).fetchone()
        daily_report_id = int(dr["id"]) if dr else None

        for entry in items:
            if "closingKg" not in entry:
                continue
            feed_item_id = entry.get("feedItemId")
            if feed_item_id is None:
                raise ValueError("feedItemId is required for each item")
            fid = int(feed_item_id)
            try:
                closing = float(entry["closingKg"])
            except (TypeError, ValueError) as exc:
                raise ValueError("closingKg must be a number") from exc
            if closing < 0:
                raise ValueError("closingKg must be non-negative")

            row = conn.execute(
                """
                SELECT id, openingKg, receiptsKg
                FROM feed_item_daily_stock
                WHERE reportDate = %s AND feedItemId = %s
                """,
                (report_date, fid),
            ).fetchone()

            if row:
                opening = float(row["openingKg"] or 0)
                receipts = float(row["receiptsKg"] or 0)
                used = opening + receipts - closing
                conn.execute(
                    """
                    UPDATE feed_item_daily_stock
                    SET manualClosingKg = %s,
                        closingKg = %s,
                        usedKg = %s,
                        updatedAt = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (closing, closing, used, row["id"]),
                )
            else:
                prev = conn.execute(
                    """
                    SELECT s.closingKg
                    FROM feed_item_daily_stock s
                    INNER JOIN (
                      SELECT MAX(reportDate) AS md
                      FROM feed_item_daily_stock
                      WHERE reportDate < %s AND feedItemId = %s
                    ) p ON s.reportDate = p.md AND s.feedItemId = %s
                    """,
                    (report_date, fid, fid),
                ).fetchone()
                opening = float(prev["closingKg"] or 0) if prev else 0.0
                receipts = 0.0
                if daily_report_id is not None:
                    rrow = conn.execute(
                        """
                        SELECT COALESCE(SUM(quantityKg), 0) AS r
                        FROM feed_receipts
                        WHERE dailyReportId = %s AND feedItemId = %s
                        """,
                        (daily_report_id, fid),
                    ).fetchone()
                    receipts = float(rrow["r"] or 0)
                used = opening + receipts - closing
                conn.execute(
                    """
                    INSERT INTO feed_item_daily_stock (
                      reportDate, feedItemId,
                      openingKg, receiptsKg, usedKg, closingKg, manualClosingKg,
                      createdAt, updatedAt
                    ) VALUES (
                      %s, %s, %s, %s, %s, %s, %s,
                      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    )
                    """,
                    (report_date, fid, opening, receipts, used, closing, closing),
                )

        conn.commit()

    return get_latest_feed_item_daily_stock_snapshot()
