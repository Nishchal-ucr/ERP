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
            f"SELECT * FROM {table_name} WHERE id = ?",
            (item_id,),
        ).fetchone()
    return _row_to_dict(row)
