from db.connection import get_connection


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
