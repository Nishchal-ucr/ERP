from datetime import date, datetime
from typing import Any

from db.connection import get_connection
from services.csv_initialization_service import _choose_baseline_date


def _row_to_dict(row):
    if row is None:
        return None
    value = dict(row)
    if "active" in value:
        value["active"] = bool(value["active"])
    return value


def get_all(table_name: str):
    with get_connection() as conn:
        rows = conn.execute(f"SELECT * FROM {table_name}").fetchall()
    return [_row_to_dict(row) for row in rows]


def get_by_id(table_name: str, item_id: int):
    with get_connection() as conn:
        row = conn.execute(
            f"SELECT * FROM {table_name} WHERE id = %s",
            (item_id,),
        ).fetchone()
    return _row_to_dict(row)


def get_parties_by_role(role: str):
    role_key = (role or "").strip().lower()
    if role_key == "buyer":
        allowed = ("CUSTOMER", "BOTH")
    elif role_key == "seller":
        allowed = ("SUPPLIER", "BOTH")
    else:
        raise ValueError("role must be either 'buyer' or 'seller'")
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM parties
            WHERE type IN (%s, %s)
            ORDER BY name
            """,
            allowed,
        ).fetchall()
    return [_row_to_dict(row) for row in rows]


def party_type_from_role(role: str) -> str:
    role_key = (role or "").strip().lower()
    if role_key == "buyer":
        return "CUSTOMER"
    if role_key == "seller":
        return "SUPPLIER"
    raise ValueError("role must be either 'buyer' or 'seller'")


def create_party(
    name: str,
    party_type: str,
    phone: str | None = None,
    address: str | None = None,
):
    name_clean = (name or "").strip()
    if not name_clean:
        raise ValueError("name is required")
    if party_type not in ("SUPPLIER", "CUSTOMER", "BOTH"):
        raise ValueError("type must be SUPPLIER, CUSTOMER, or BOTH")
    with get_connection() as conn:
        existing = conn.execute(
            """
            SELECT id FROM parties
            WHERE LOWER(TRIM(name)) = LOWER(%s) AND type = %s
            LIMIT 1
            """,
            (name_clean, party_type),
        ).fetchone()
        if existing:
            party_id = int(existing["id"])
            created = False
        else:
            row = conn.execute(
                """
                INSERT INTO parties (name, type, phone, address)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (name_clean, party_type, phone, address),
            ).fetchone()
            party_id = int(row["id"])
            created = True
    return get_by_id("parties", party_id), created


def _apply_feed_item_master_extensions(
    conn, feed_item_id: int, closing_kg: float
) -> None:
    """Insert zero formulations per shed and baseline feed_item_daily_stock (matches CSV init semantics)."""
    report_date = _choose_baseline_date(conn)
    shed_rows = conn.execute("SELECT id FROM sheds ORDER BY id").fetchall()
    for row in shed_rows:
        shed_id = int(row["id"])
        exists = conn.execute(
            """
            SELECT 1 FROM feed_formulations
            WHERE shedId = %s AND feedItemId = %s
            LIMIT 1
            """,
            (shed_id, feed_item_id),
        ).fetchone()
        if not exists:
            conn.execute(
                """
                INSERT INTO feed_formulations (shedId, feedItemId, ratioPer1000Kg)
                VALUES (%s, %s, 0)
                """,
                (shed_id, feed_item_id),
            )
    stock = conn.execute(
        """
        SELECT id, closingKg FROM feed_item_daily_stock
        WHERE reportDate = %s AND feedItemId = %s
        LIMIT 1
        """,
        (report_date, feed_item_id),
    ).fetchone()
    if stock:
        conn.execute(
            """
            UPDATE feed_item_daily_stock
            SET openingKg = %s, receiptsKg = 0, usedKg = 0, closingKg = %s, updatedAt = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (closing_kg, closing_kg, int(stock["id"])),
        )
    else:
        conn.execute(
            """
            INSERT INTO feed_item_daily_stock (
              reportDate, feedItemId, openingKg, receiptsKg, usedKg, closingKg, createdAt, updatedAt
            ) VALUES (%s, %s, %s, 0, 0, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (report_date, feed_item_id, closing_kg, closing_kg),
        )


def create_feed_item(name: str, category: str, closing_kg: float = 0.0):
    name_clean = (name or "").strip()
    if not name_clean:
        raise ValueError("name is required")
    if category not in ("INGREDIENT", "MEDICINE"):
        raise ValueError("category must be INGREDIENT or MEDICINE")
    with get_connection() as conn:
        existing = conn.execute(
            """
            SELECT id FROM feed_items
            WHERE LOWER(TRIM(name)) = LOWER(%s) AND category = %s
            LIMIT 1
            """,
            (name_clean, category),
        ).fetchone()
        if existing:
            item_id = int(existing["id"])
            created = False
        else:
            row = conn.execute(
                """
                INSERT INTO feed_items (name, category)
                VALUES (%s, %s)
                RETURNING id
                """,
                (name_clean, category),
            ).fetchone()
            item_id = int(row["id"])
            created = True
            _apply_feed_item_master_extensions(conn, item_id, closing_kg)
    return get_by_id("feed_items", item_id), created


def get_feed_formulations():
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
              ff.id,
              ff.shedId,
              sh.name AS shedName,
              ff.feedItemId,
              fi.name AS feedItemName,
              ff.ratioPer1000Kg,
              ff.createdAt,
              ff.updatedAt
            FROM feed_formulations ff
            LEFT JOIN sheds sh ON sh.id = ff.shedId
            LEFT JOIN feed_items fi ON fi.id = ff.feedItemId
            ORDER BY sh.name, fi.name
            """
        ).fetchall()
    return [dict(row) for row in rows]


def get_feed_formulation_by_id(item_id: int):
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT
              ff.id,
              ff.shedId,
              sh.name AS shedName,
              ff.feedItemId,
              fi.name AS feedItemName,
              ff.ratioPer1000Kg,
              ff.createdAt,
              ff.updatedAt
            FROM feed_formulations ff
            LEFT JOIN sheds sh ON sh.id = ff.shedId
            LEFT JOIN feed_items fi ON fi.id = ff.feedItemId
            WHERE ff.id = %s
            """,
            (item_id,),
        ).fetchone()
    return _row_to_dict(row)


def _parse_birth_date(birth_raw: Any) -> date | None:
    if birth_raw is None:
        return None
    if isinstance(birth_raw, datetime):
        return birth_raw.date()
    if isinstance(birth_raw, date):
        return birth_raw
    if isinstance(birth_raw, str):
        try:
            return datetime.strptime(birth_raw.strip()[:10], "%Y-%m-%d").date()
        except ValueError:
            return None
    return None


def get_flock_summary() -> list[dict[str, Any]]:
    """Per active shed: flock id, birth date, latest closing birds, age in weeks."""
    today = date.today()
    today_int = int(f"{today.year}{today.month:02d}{today.day:02d}")
    sql = """
        SELECT
          s.id AS "shedId",
          s.name AS "shedName",
          m.flockNumber,
          m.birthDate,
          latest.closingBirds
        FROM sheds s
        LEFT JOIN shed_flock_metadata m ON m.shedId = s.id
        LEFT JOIN LATERAL (
          SELECT sdr.closingBirds
          FROM shed_daily_reports sdr
          JOIN daily_reports dr ON dr.id = sdr.dailyReportId
          WHERE sdr.shedId = s.id AND dr.reportDate <= %s
          ORDER BY dr.reportDate DESC
          LIMIT 1
        ) latest ON TRUE
        WHERE s.active = 1
        ORDER BY s.id
    """
    with get_connection() as conn:
        rows = conn.execute(sql, (today_int,)).fetchall()

    out: list[dict[str, Any]] = []
    for row in rows:
        r = dict(row)
        birth = _parse_birth_date(r.get("birthDate"))
        age_weeks: int | None = None
        if birth is not None:
            age_weeks = max(0, (today - birth).days // 7)
        out.append(
            {
                "shedId": r.get("shedId"),
                "shedName": r.get("shedName"),
                "flockNumber": r.get("flockNumber"),
                "birthDate": r.get("birthDate"),
                "closingBirds": r.get("closingBirds"),
                "ageWeeks": age_weeks,
            }
        )
    return out
