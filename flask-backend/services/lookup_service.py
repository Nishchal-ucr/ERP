from datetime import date, datetime
from typing import Any

from db.connection import get_connection
from services.csv_initialization_service import _choose_baseline_date
from services.flock_placement_service import (
    ShedNotFoundError,
    _ensure_flock_number_unique,
)


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
        return list_parties(active=None, kind="buyer")
    if role_key == "seller":
        return list_parties(active=None, kind="seller")
    raise ValueError("role must be either 'buyer' or 'seller'")


def list_parties(
    active: bool | None = None,
    kind: str | None = None,
) -> list[dict[str, Any]]:
    """Filter parties. kind: buyer (CUSTOMER+BOTH), seller (SUPPLIER+BOTH), both (BOTH only)."""
    conditions: list[str] = []
    params: list[Any] = []

    if active is True:
        conditions.append("active = %s")
        params.append(1)
    elif active is False:
        conditions.append("active = %s")
        params.append(0)

    k = (kind or "").strip().lower()
    if k == "buyer":
        conditions.append("type IN (%s, %s)")
        params.extend(("CUSTOMER", "BOTH"))
    elif k == "seller":
        conditions.append("type IN (%s, %s)")
        params.extend(("SUPPLIER", "BOTH"))
    elif k == "both":
        conditions.append("type = %s")
        params.append("BOTH")
    elif k:
        raise ValueError("kind must be buyer, seller, or both")

    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    sql = f"SELECT * FROM parties WHERE {where_clause} ORDER BY name"
    with get_connection() as conn:
        rows = conn.execute(sql, tuple(params)).fetchall()
    return [_row_to_dict(row) for row in rows]


def party_type_from_role(role: str) -> str:
    role_key = (role or "").strip().lower()
    if role_key == "buyer":
        return "CUSTOMER"
    if role_key == "seller":
        return "SUPPLIER"
    if role_key == "both":
        return "BOTH"
    raise ValueError("role must be either 'buyer', 'seller', or 'both'")


def create_party(
    name: str,
    party_type: str,
    phone: str | None = None,
    address: str | None = None,
    email: str | None = None,
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
                INSERT INTO parties (name, type, phone, address, email)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
                """,
                (name_clean, party_type, phone, address, email),
            ).fetchone()
            party_id = int(row["id"])
            created = True
    return get_by_id("parties", party_id), created


def update_party_active(party_id: int, active: bool) -> dict[str, Any] | None:
    """Set parties.active. Returns updated row or None if id is missing."""
    with get_connection() as conn:
        cur = conn.execute(
            """
            UPDATE parties
            SET active = %s, updatedAt = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id
            """,
            (1 if active else 0, party_id),
        )
        row = cur.fetchone()
        if not row:
            return None
    return get_by_id("parties", party_id)


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


def delete_feed_item(feed_item_id: int) -> None:
    """Remove a feed item if it has no blocking stock, formulation use, or receipts."""
    with get_connection() as conn:
        exists = conn.execute(
            "SELECT id FROM feed_items WHERE id = %s LIMIT 1",
            (feed_item_id,),
        ).fetchone()
        if not exists:
            raise ValueError("Feed item not found.")

        max_row = conn.execute(
            "SELECT MAX(reportDate) AS maxDate FROM feed_item_daily_stock"
        ).fetchone()
        max_date = max_row["maxDate"] if max_row else None
        if max_date is not None:
            stock = conn.execute(
                """
                SELECT closingKg FROM feed_item_daily_stock
                WHERE reportDate = %s AND feedItemId = %s
                LIMIT 1
                """,
                (int(max_date), feed_item_id),
            ).fetchone()
            if stock and float(stock["closingKg"] or 0) > 0:
                raise ValueError(
                    "Cannot delete feed item: latest closing stock is greater than zero."
                )

        used = conn.execute(
            """
            SELECT 1 FROM feed_formulations
            WHERE feedItemId = %s AND ratioPer1000Kg > 0
            LIMIT 1
            """,
            (feed_item_id,),
        ).fetchone()
        if used:
            raise ValueError(
                "Cannot delete feed item: it is used in a feed formulation mix."
            )

        n_receipts = conn.execute(
            "SELECT COUNT(*) AS c FROM feed_receipts WHERE feedItemId = %s",
            (feed_item_id,),
        ).fetchone()
        if int(n_receipts["c"] or 0) > 0:
            raise ValueError(
                "Cannot delete feed item: it is referenced by feed receipts."
            )

        conn.execute(
            "DELETE FROM feed_formulations WHERE feedItemId = %s",
            (feed_item_id,),
        )
        conn.execute(
            "DELETE FROM feed_item_daily_stock WHERE feedItemId = %s",
            (feed_item_id,),
        )
        conn.execute("DELETE FROM feed_items WHERE id = %s", (feed_item_id,))


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


def update_feed_formulation(formulation_id: int, ratio_per_1000_kg: float):
    if ratio_per_1000_kg < 0:
        raise ValueError("ratioPer1000Kg must be non-negative")
    with get_connection() as conn:
        exists = conn.execute(
            "SELECT id FROM feed_formulations WHERE id = %s LIMIT 1",
            (formulation_id,),
        ).fetchone()
        if not exists:
            raise ValueError("Feed formulation not found.")
        conn.execute(
            """
            UPDATE feed_formulations
            SET ratioPer1000Kg = %s, updatedAt = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (ratio_per_1000_kg, formulation_id),
        )
    row = get_feed_formulation_by_id(formulation_id)
    if row is None:
        raise ValueError("Feed formulation not found.")
    return row


def create_feed_formulation(shed_id: int, feed_item_id: int, ratio_per_1000_kg: float):
    if ratio_per_1000_kg < 0:
        raise ValueError("ratioPer1000Kg must be non-negative")
    with get_connection() as conn:
        shed = conn.execute(
            "SELECT id FROM sheds WHERE id = %s LIMIT 1",
            (shed_id,),
        ).fetchone()
        if not shed:
            raise ValueError("Shed not found.")
        item = conn.execute(
            "SELECT id FROM feed_items WHERE id = %s LIMIT 1",
            (feed_item_id,),
        ).fetchone()
        if not item:
            raise ValueError("Feed item not found.")
        dup = conn.execute(
            """
            SELECT id FROM feed_formulations
            WHERE shedId = %s AND feedItemId = %s
            LIMIT 1
            """,
            (shed_id, feed_item_id),
        ).fetchone()
        if dup:
            raise ValueError(
                "A formulation row already exists for this shed and feed item."
            )
        row = conn.execute(
            """
            INSERT INTO feed_formulations (shedId, feedItemId, ratioPer1000Kg)
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (shed_id, feed_item_id, ratio_per_1000_kg),
        ).fetchone()
        new_id = int(row["id"])
    created = get_feed_formulation_by_id(new_id)
    if created is None:
        raise ValueError("Feed formulation not found.")
    return created


def delete_feed_formulation(formulation_id: int) -> None:
    with get_connection() as conn:
        deleted = conn.execute(
            "DELETE FROM feed_formulations WHERE id = %s RETURNING id",
            (formulation_id,),
        ).fetchone()
        if not deleted:
            raise ValueError("Feed formulation not found.")


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


def update_shed_flock_number(shed_id: int, flock_number: str) -> dict[str, Any]:
    """Update flock ID on sheds and shed_flock_metadata (insert metadata if missing)."""
    fn = (flock_number or "").strip()
    if not fn:
        raise ValueError("flockNumber is required")

    with get_connection() as conn:
        shed = conn.execute(
            "SELECT id, active FROM sheds WHERE id = %s",
            (shed_id,),
        ).fetchone()
        if not shed or not shed.get("active"):
            raise ShedNotFoundError()

        _ensure_flock_number_unique(conn, shed_id, fn)

        conn.execute(
            """
            UPDATE sheds
            SET flockNumber = %s, updatedAt = CURRENT_TIMESTAMP
            WHERE id = %s
            """,
            (fn, shed_id),
        )

        meta = conn.execute(
            "SELECT id FROM shed_flock_metadata WHERE shedId = %s",
            (shed_id,),
        ).fetchone()
        if meta:
            conn.execute(
                """
                UPDATE shed_flock_metadata
                SET flockNumber = %s, updatedAt = CURRENT_TIMESTAMP
                WHERE shedId = %s
                """,
                (fn, shed_id),
            )
        else:
            conn.execute(
                """
                INSERT INTO shed_flock_metadata (shedId, flockNumber, birthDate, updatedAt)
                VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
                """,
                (shed_id, fn, "2000-01-01"),
            )

    out = get_by_id("sheds", shed_id)
    if not out:
        raise ShedNotFoundError()
    return out
