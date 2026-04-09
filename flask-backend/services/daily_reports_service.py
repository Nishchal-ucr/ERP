from datetime import datetime, timezone
from pathlib import Path

from db.connection import get_connection
from services.email_service import send_reports_email
from services.reporting_service import generate_report_pdfs
from utils.date_utils import parse_iso_date_to_yyyymmdd


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _dict_or_none(row):
    return dict(row) if row else None


def _attempt_generate_and_send_reports(report_payload: dict) -> str | None:
    if not report_payload:
        return "Unable to load report details for email."
    report_date = report_payload.get("reportDate")
    if isinstance(report_date, int):
        report_date = f"{str(report_date)[0:4]}-{str(report_date)[4:6]}-{str(report_date)[6:8]}"
    report_date = str(report_date)

    pdf_paths = []
    try:
        pdf_paths = generate_report_pdfs(report_payload)
        return send_reports_email(report_date, pdf_paths)
    except Exception as exc:
        return f"Failed to generate or send reports: {exc}"
    finally:
        for p in pdf_paths:
            try:
                Path(p).unlink(missing_ok=True)
            except Exception:
                pass


def _get_report_with_user(conn, report_id: int):
    row = conn.execute(
        """
        SELECT
          dr.*,
          u.id AS user_id,
          u.name AS user_name,
          u.phone AS user_phone,
          u.role AS user_role,
          u.createdAt AS user_createdAt
        FROM daily_reports dr
        LEFT JOIN users u ON u.id = dr.createdByUserId
        WHERE dr.id = %s
        """,
        (report_id,),
    ).fetchone()
    if not row:
        return None

    report = dict(row)
    report["createdByUser"] = {
        "id": report.pop("user_id"),
        "name": report.pop("user_name"),
        "phone": report.pop("user_phone"),
        "role": report.pop("user_role"),
        "createdAt": report.pop("user_createdat"),
    }
    return report


def _load_sales(conn, daily_report_id: int):
    sales = conn.execute(
        """
        SELECT
          s.*,
          p.id AS party_id,
          p.name AS party_name,
          p.type AS party_type,
          p.phone AS party_phone,
          p.address AS party_address,
          p.createdAt AS party_createdAt,
          p.updatedAt AS party_updatedAt
        FROM sales s
        LEFT JOIN parties p ON p.id = s.partyId
        WHERE s.dailyReportId = %s
        """,
        (daily_report_id,),
    ).fetchall()
    if not sales:
        return []

    sale_ids = [row["id"] for row in sales]
    placeholders = ",".join("%s" for _ in sale_ids)
    sale_items = conn.execute(
        f"""
        SELECT
          si.*,
          sh.id AS shed_id,
          sh.name AS shed_name,
          sh.capacity AS shed_capacity,
          sh.flockNumber AS shed_flockNumber,
          sh.active AS shed_active,
          sh.createdAt AS shed_createdAt,
          sh.updatedAt AS shed_updatedAt
        FROM sale_items si
        LEFT JOIN sheds sh ON sh.id = si.shedId
        WHERE si.saleId IN ({placeholders})
        """,
        sale_ids,
    ).fetchall()

    mapped = []
    for sale in sales:
        sale_dict = dict(sale)
        sale_dict["party"] = {
            "id": sale_dict.pop("party_id"),
            "name": sale_dict.pop("party_name"),
            "type": sale_dict.pop("party_type"),
            "phone": sale_dict.pop("party_phone"),
            "address": sale_dict.pop("party_address"),
            "createdAt": sale_dict.pop("party_createdat"),
            "updatedAt": sale_dict.pop("party_updatedat"),
        }
        items = []
        for item in sale_items:
            if item["saleId"] != sale["id"]:
                continue
            item_dict = dict(item)
            item_dict["shed"] = {
                "id": item_dict.pop("shed_id"),
                "name": item_dict.pop("shed_name"),
                "capacity": item_dict.pop("shed_capacity"),
                "flockNumber": item_dict.pop("shed_flocknumber"),
                "active": bool(item_dict.pop("shed_active")),
                "createdAt": item_dict.pop("shed_createdat"),
                "updatedAt": item_dict.pop("shed_updatedat"),
            }
            items.append(item_dict)
        sale_dict["items"] = items
        mapped.append(sale_dict)
    return mapped


def _load_feed_receipts(conn, daily_report_id: int):
    rows = conn.execute(
        """
        SELECT
          fr.*,
          p.id AS party_id,
          p.name AS party_name,
          p.type AS party_type,
          p.phone AS party_phone,
          p.address AS party_address,
          p.createdAt AS party_createdAt,
          p.updatedAt AS party_updatedAt,
          fi.id AS feedItem_id,
          fi.name AS feedItem_name,
          fi.category AS feedItem_category,
          fi.createdAt AS feedItem_createdAt,
          fi.updatedAt AS feedItem_updatedAt
        FROM feed_receipts fr
        LEFT JOIN parties p ON p.id = fr.partyId
        LEFT JOIN feed_items fi ON fi.id = fr.feedItemId
        WHERE fr.dailyReportId = %s
        """,
        (daily_report_id,),
    ).fetchall()

    mapped = []
    for row in rows:
        obj = dict(row)
        obj["party"] = {
            "id": obj.pop("party_id"),
            "name": obj.pop("party_name"),
            "type": obj.pop("party_type"),
            "phone": obj.pop("party_phone"),
            "address": obj.pop("party_address"),
            "createdAt": obj.pop("party_createdat"),
            "updatedAt": obj.pop("party_updatedat"),
        }
        obj["feedItem"] = {
            "id": obj.pop("feeditem_id"),
            "name": obj.pop("feeditem_name"),
            "category": obj.pop("feeditem_category"),
            "createdAt": obj.pop("feeditem_createdat"),
            "updatedAt": obj.pop("feeditem_updatedat"),
        }
        mapped.append(obj)
    return mapped


def _load_shed_daily_reports(conn, daily_report_id: int):
    rows = conn.execute(
        """
        SELECT
          sdr.*,
          sh.id AS shed_id,
          sh.name AS shed_name,
          sh.capacity AS shed_capacity,
          sh.flockNumber AS shed_flockNumber,
          sh.active AS shed_active,
          sh.createdAt AS shed_createdAt,
          sh.updatedAt AS shed_updatedAt
        FROM shed_daily_reports sdr
        LEFT JOIN sheds sh ON sh.id = sdr.shedId
        WHERE sdr.dailyReportId = %s
        """,
        (daily_report_id,),
    ).fetchall()

    mapped = []
    for row in rows:
        obj = dict(row)
        obj["shed"] = {
            "id": obj.pop("shed_id"),
            "name": obj.pop("shed_name"),
            "capacity": obj.pop("shed_capacity"),
            "flockNumber": obj.pop("shed_flocknumber"),
            "active": bool(obj.pop("shed_active")),
            "createdAt": obj.pop("shed_createdat"),
            "updatedAt": obj.pop("shed_updatedat"),
        }
        mapped.append(obj)
    return mapped


def build_daily_report_details(conn, daily_report):
    report_id = daily_report["id"]
    payload = dict(daily_report)
    payload["sales"] = _load_sales(conn, report_id)
    payload["feedReceipts"] = _load_feed_receipts(conn, report_id)
    payload["shedDailyReports"] = _load_shed_daily_reports(conn, report_id)
    return payload


def list_daily_reports():
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
              dr.*,
              u.id AS user_id,
              u.name AS user_name,
              u.phone AS user_phone,
              u.role AS user_role,
              u.createdAt AS user_createdAt
            FROM daily_reports dr
            LEFT JOIN users u ON u.id = dr.createdByUserId
            ORDER BY dr.reportDate DESC
            """
        ).fetchall()

    output = []
    for row in rows:
        item = dict(row)
        item["createdByUser"] = {
            "id": item.pop("user_id"),
            "name": item.pop("user_name"),
            "phone": item.pop("user_phone"),
            "role": item.pop("user_role"),
            "createdAt": item.pop("user_createdat"),
        }
        output.append(item)
    return output


def get_daily_report_with_details(report_id: int):
    with get_connection() as conn:
        report = _get_report_with_user(conn, report_id)
        if not report:
            return None
        return build_daily_report_details(conn, report)


def get_daily_report_by_date(date_string: str):
    report_date = parse_iso_date_to_yyyymmdd(date_string)
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id FROM daily_reports WHERE reportDate = %s",
            (report_date,),
        ).fetchone()
        if not row:
            return None
        report = _get_report_with_user(conn, row["id"])
        return build_daily_report_details(conn, report)


def _insert_sales(conn, daily_report_id: int, sales):
    for sale in sales or []:
        cur = conn.execute(
            """
            INSERT INTO sales (dailyReportId, partyId, vehicleNumber, createdAt, updatedAt)
            VALUES (%s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id
            """,
            (daily_report_id, sale["partyId"], sale.get("vehicleNumber")),
        )
        sale_id = cur.fetchone()["id"]
        for item in sale.get("items", []):
            conn.execute(
                """
                INSERT INTO sale_items (
                  saleId, shedId, standardEggs, smallEggs, bigEggs, loadingDamage, createdAt, updatedAt
                ) VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                (
                    sale_id,
                    item["shedId"],
                    item.get("standardEggs", 0) or 0,
                    item.get("smallEggs", 0) or 0,
                    item.get("bigEggs", 0) or 0,
                    item.get("loadingDamage", 0) or 0,
                ),
            )


def _insert_feed_receipts(conn, daily_report_id: int, receipts):
    for receipt in receipts or []:
        conn.execute(
            """
            INSERT INTO feed_receipts (
              dailyReportId, partyId, feedItemId, vehicleNumber, quantityKg, createdAt, updatedAt
            ) VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (
                daily_report_id,
                receipt["partyId"],
                receipt["feedItemId"],
                receipt.get("vehicleNumber"),
                receipt["quantityKg"],
            ),
        )


def _insert_shed_daily_reports(conn, daily_report_id: int, reports):
    for item in reports or []:
        feed_issued = item.get("feedIssued", item.get("totalFeedReceipt"))
        feed_closing = item.get("feedClosing", item.get("closingFeed"))
        conn.execute(
            """
            INSERT INTO shed_daily_reports (
              dailyReportId, shedId, openingBirds, birdsMortality, closingBirds, openingEggs, damagedEggs,
              standardEggsClosing, smallEggsClosing, bigEggsClosing,
              feedOpening, feedIssued, feedClosing, feedConsumed, totalEggsClosing, eggsProduced,
              totalFeedReceipt, closingFeed, createdAt, updatedAt
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (
                daily_report_id,
                item["shedId"],
                item.get("openingBirds"),
                item.get("birdsMortality"),
                item.get("closingBirds"),
                item.get("openingEggs"),
                item.get("damagedEggs"),
                item.get("standardEggsClosing"),
                item.get("smallEggsClosing"),
                item.get("bigEggsClosing"),
                item.get("feedOpening"),
                feed_issued,
                feed_closing,
                item.get("feedConsumed"),
                item.get("totalEggsClosing"),
                item.get("eggsProduced"),
                feed_issued,
                feed_closing,
            ),
        )


def _validate_party_roles(conn, payload: dict) -> None:
    sales = payload.get("sales") or []
    feed_receipts = payload.get("feedReceipts") or []

    sales_party_ids = {int(item["partyId"]) for item in sales if item.get("partyId") is not None}
    feed_party_ids = {
        int(item["partyId"]) for item in feed_receipts if item.get("partyId") is not None
    }
    all_ids = sorted(sales_party_ids | feed_party_ids)
    if not all_ids:
        return

    placeholders = ",".join("%s" for _ in all_ids)
    rows = conn.execute(
        f"SELECT id, type FROM parties WHERE id IN ({placeholders})",
        all_ids,
    ).fetchall()
    type_by_id = {int(row["id"]): str(row["type"]) for row in rows}

    for party_id in sales_party_ids:
        party_type = type_by_id.get(party_id)
        if party_type is None:
            raise ValueError(f"Sales party {party_id} does not exist.")
        if party_type not in {"CUSTOMER", "BOTH"}:
            raise ValueError(
                f"Sales party {party_id} must be CUSTOMER or BOTH, found {party_type}."
            )

    for party_id in feed_party_ids:
        party_type = type_by_id.get(party_id)
        if party_type is None:
            raise ValueError(f"Feed receipt party {party_id} does not exist.")
        if party_type not in {"SUPPLIER", "BOTH"}:
            raise ValueError(
                f"Feed receipt party {party_id} must be SUPPLIER or BOTH, found {party_type}."
            )


def _recalculate_feed_item_daily_stock(conn, daily_report_id: int, report_date: int) -> None:
    feed_items = conn.execute(
        "SELECT id FROM feed_items ORDER BY id"
    ).fetchall()
    feed_item_ids = [int(row["id"]) for row in feed_items]
    if not feed_item_ids:
        return

    prev_day_closing_rows = conn.execute(
        """
        SELECT s.feedItemId, s.closingKg
        FROM feed_item_daily_stock s
        INNER JOIN (
          SELECT feedItemId, MAX(reportDate) AS maxReportDate
          FROM feed_item_daily_stock
          WHERE reportDate < %s
          GROUP BY feedItemId
        ) p
          ON p.feedItemId = s.feedItemId
         AND p.maxReportDate = s.reportDate
        """,
        (report_date,),
    ).fetchall()
    opening_by_item = {
        int(row["feedItemId"]): float(row["closingKg"] or 0) for row in prev_day_closing_rows
    }

    receipt_rows = conn.execute(
        """
        SELECT feedItemId, SUM(quantityKg) AS receiptsKg
        FROM feed_receipts
        WHERE dailyReportId = %s
        GROUP BY feedItemId
        """,
        (daily_report_id,),
    ).fetchall()
    receipts_by_item = {
        int(row["feedItemId"]): float(row["receiptsKg"] or 0) for row in receipt_rows
    }

    issued_rows = conn.execute(
        """
        SELECT shedId, SUM(feedIssued) AS issuedKg
        FROM shed_daily_reports
        WHERE dailyReportId = %s
        GROUP BY shedId
        """,
        (daily_report_id,),
    ).fetchall()
    issued_by_shed = {int(row["shedId"]): float(row["issuedkg"] or 0) for row in issued_rows}

    formulation_rows = conn.execute(
        "SELECT shedId, feedItemId, ratioPer1000Kg FROM feed_formulations"
    ).fetchall()
    used_by_item = {item_id: 0.0 for item_id in feed_item_ids}
    for row in formulation_rows:
        shed_id = int(row["shedId"])
        item_id = int(row["feedItemId"])
        issued = float(issued_by_shed.get(shed_id, 0))
        ratio = float(row["ratioPer1000Kg"] or 0)
        if issued == 0 or ratio == 0:
            continue
        used_by_item[item_id] = used_by_item.get(item_id, 0.0) + (issued * ratio / 1000.0)

    for item_id in feed_item_ids:
        opening = float(opening_by_item.get(item_id, 0))
        receipts = float(receipts_by_item.get(item_id, 0))
        used = float(used_by_item.get(item_id, 0))
        closing = opening + receipts - used
        existing = conn.execute(
            "SELECT id FROM feed_item_daily_stock WHERE reportDate = %s AND feedItemId = %s",
            (report_date, item_id),
        ).fetchone()
        if existing:
            conn.execute(
                """
                UPDATE feed_item_daily_stock
                SET openingKg = %s, receiptsKg = %s, usedKg = %s, closingKg = %s, updatedAt = CURRENT_TIMESTAMP
                WHERE id = %s
                """,
                (opening, receipts, used, closing, existing["id"]),
            )
        else:
            conn.execute(
                """
                INSERT INTO feed_item_daily_stock (
                  reportDate, feedItemId, openingKg, receiptsKg, usedKg, closingKg, createdAt, updatedAt
                ) VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                (report_date, item_id, opening, receipts, used, closing),
            )


def submit_daily_report(payload):
    report_date = parse_iso_date_to_yyyymmdd(payload["reportDate"])
    with get_connection() as conn:
        _validate_party_roles(conn, payload)
        existing = conn.execute(
            "SELECT id FROM daily_reports WHERE reportDate = %s",
            (report_date,),
        ).fetchone()
        if existing:
            raise ValueError(
                "Cannot submit: A report for this date has already been submitted."
            )

        cur = conn.execute(
            """
            INSERT INTO daily_reports (reportDate, createdByUserId, status, submittedAt, createdAt, updatedAt)
            VALUES (%s, %s, 'SUBMITTED', %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id
            """,
            (report_date, payload["submitterId"], _now_iso()),
        )
        report_id = cur.fetchone()["id"]

        _insert_sales(conn, report_id, payload.get("sales"))
        _insert_feed_receipts(conn, report_id, payload.get("feedReceipts"))
        _insert_shed_daily_reports(conn, report_id, payload.get("shedDailyReports"))
        _recalculate_feed_item_daily_stock(conn, report_id, report_date)
        conn.commit()

        row = conn.execute("SELECT * FROM daily_reports WHERE id = %s", (report_id,)).fetchone()
        response = _dict_or_none(row)

    full_report = get_daily_report_with_details(report_id)
    email_warning = _attempt_generate_and_send_reports(full_report)
    if response is not None and email_warning:
        response["emailWarning"] = email_warning
    return response


def update_daily_report(payload):
    report_date = parse_iso_date_to_yyyymmdd(payload["reportDate"])
    with get_connection() as conn:
        _validate_party_roles(conn, payload)
        report = conn.execute(
            "SELECT * FROM daily_reports WHERE reportDate = %s",
            (report_date,),
        ).fetchone()
        if not report:
            return None, "not_found"

        max_row = conn.execute("SELECT MAX(reportDate) AS maxDate FROM daily_reports").fetchone()
        max_date = max_row["maxDate"] if max_row else None
        if max_date and int(max_date) > report_date:
            return None, "locked"

        conn.execute(
            """
            UPDATE daily_reports
            SET status = 'SUBMITTED', submittedAt = %s, createdByUserId = %s, updatedAt = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (_now_iso(), payload["submitterId"], report["id"]),
        )
        conn.execute("DELETE FROM sales WHERE dailyReportId = %s", (report["id"],))
        conn.execute("DELETE FROM feed_receipts WHERE dailyReportId = %s", (report["id"],))
        conn.execute("DELETE FROM shed_daily_reports WHERE dailyReportId = %s", (report["id"],))

        _insert_sales(conn, report["id"], payload.get("sales"))
        _insert_feed_receipts(conn, report["id"], payload.get("feedReceipts"))
        _insert_shed_daily_reports(conn, report["id"], payload.get("shedDailyReports"))
        _recalculate_feed_item_daily_stock(conn, int(report["id"]), report_date)
        conn.commit()

        updated = conn.execute(
            "SELECT * FROM daily_reports WHERE id = %s",
            (report["id"],),
        ).fetchone()
        response = _dict_or_none(updated)
        report_id = int(report["id"])

    full_report = get_daily_report_with_details(report_id)
    email_warning = _attempt_generate_and_send_reports(full_report)
    if response is not None and email_warning:
        response["emailWarning"] = email_warning
    return response, None
