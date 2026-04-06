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
        WHERE dr.id = ?
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
        "createdAt": report.pop("user_createdAt"),
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
        WHERE s.dailyReportId = ?
        """,
        (daily_report_id,),
    ).fetchall()
    if not sales:
        return []

    sale_ids = [row["id"] for row in sales]
    placeholders = ",".join("?" for _ in sale_ids)
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
            "createdAt": sale_dict.pop("party_createdAt"),
            "updatedAt": sale_dict.pop("party_updatedAt"),
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
                "flockNumber": item_dict.pop("shed_flockNumber"),
                "active": bool(item_dict.pop("shed_active")),
                "createdAt": item_dict.pop("shed_createdAt"),
                "updatedAt": item_dict.pop("shed_updatedAt"),
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
        WHERE fr.dailyReportId = ?
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
            "createdAt": obj.pop("party_createdAt"),
            "updatedAt": obj.pop("party_updatedAt"),
        }
        obj["feedItem"] = {
            "id": obj.pop("feedItem_id"),
            "name": obj.pop("feedItem_name"),
            "category": obj.pop("feedItem_category"),
            "createdAt": obj.pop("feedItem_createdAt"),
            "updatedAt": obj.pop("feedItem_updatedAt"),
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
        WHERE sdr.dailyReportId = ?
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
            "flockNumber": obj.pop("shed_flockNumber"),
            "active": bool(obj.pop("shed_active")),
            "createdAt": obj.pop("shed_createdAt"),
            "updatedAt": obj.pop("shed_updatedAt"),
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
            "createdAt": item.pop("user_createdAt"),
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
            "SELECT id FROM daily_reports WHERE reportDate = ?",
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
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (daily_report_id, sale["partyId"], sale.get("vehicleNumber")),
        )
        sale_id = cur.lastrowid
        for item in sale.get("items", []):
            conn.execute(
                """
                INSERT INTO sale_items (
                  saleId, shedId, standardEggs, smallEggs, bigEggs, loadingDamage, createdAt, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
            ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
              dailyReportId, shedId, birdsMortality, closingBirds, damagedEggs,
              standardEggsClosing, smallEggsClosing, bigEggsClosing,
              feedOpening, feedIssued, feedClosing, feedConsumed, totalEggsClosing, eggsProduced,
              totalFeedReceipt, closingFeed, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (
                daily_report_id,
                item["shedId"],
                item.get("birdsMortality"),
                item.get("closingBirds"),
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
                # Keep legacy columns populated for compatibility.
                feed_issued,
                feed_closing,
            ),
        )


def submit_daily_report(payload):
    report_date = parse_iso_date_to_yyyymmdd(payload["reportDate"])
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT id FROM daily_reports WHERE reportDate = ?",
            (report_date,),
        ).fetchone()
        if existing:
            raise ValueError(
                "Cannot submit: A report for this date has already been submitted."
            )

        cur = conn.execute(
            """
            INSERT INTO daily_reports (reportDate, createdByUserId, status, submittedAt, createdAt, updatedAt)
            VALUES (?, ?, 'SUBMITTED', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (report_date, payload["submitterId"], _now_iso()),
        )
        report_id = cur.lastrowid

        _insert_sales(conn, report_id, payload.get("sales"))
        _insert_feed_receipts(conn, report_id, payload.get("feedReceipts"))
        _insert_shed_daily_reports(conn, report_id, payload.get("shedDailyReports"))
        conn.commit()

        row = conn.execute("SELECT * FROM daily_reports WHERE id = ?", (report_id,)).fetchone()
        response = _dict_or_none(row)

    full_report = get_daily_report_with_details(report_id)
    email_warning = _attempt_generate_and_send_reports(full_report)
    if response is not None and email_warning:
        response["emailWarning"] = email_warning
    return response


def update_daily_report(payload):
    report_date = parse_iso_date_to_yyyymmdd(payload["reportDate"])
    with get_connection() as conn:
        report = conn.execute(
            "SELECT * FROM daily_reports WHERE reportDate = ?",
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
            SET status = 'SUBMITTED', submittedAt = ?, createdByUserId = ?, updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (_now_iso(), payload["submitterId"], report["id"]),
        )
        conn.execute("DELETE FROM sales WHERE dailyReportId = ?", (report["id"],))
        conn.execute("DELETE FROM feed_receipts WHERE dailyReportId = ?", (report["id"],))
        conn.execute("DELETE FROM shed_daily_reports WHERE dailyReportId = ?", (report["id"],))

        _insert_sales(conn, report["id"], payload.get("sales"))
        _insert_feed_receipts(conn, report["id"], payload.get("feedReceipts"))
        _insert_shed_daily_reports(conn, report["id"], payload.get("shedDailyReports"))
        conn.commit()

        updated = conn.execute(
            "SELECT * FROM daily_reports WHERE id = ?",
            (report["id"],),
        ).fetchone()
        response = _dict_or_none(updated)
        report_id = int(report["id"])

    full_report = get_daily_report_with_details(report_id)
    email_warning = _attempt_generate_and_send_reports(full_report)
    if response is not None and email_warning:
        response["emailWarning"] = email_warning
    return response, None
