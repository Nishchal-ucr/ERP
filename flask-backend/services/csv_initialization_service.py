from __future__ import annotations

import csv
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

from db.connection import get_connection


@dataclass
class ImportStats:
    inserted: int = 0
    updated: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "inserted": self.inserted,
            "updated": self.updated,
            "skipped": self.skipped,
            "errors": list(self.errors),
        }


def _norm(value: str | None) -> str:
    return (value or "").strip()


def _norm_key(value: str | None) -> str:
    return _norm(value).lower().replace(" ", "").replace("_", "").replace("-", "")


def _read_csv_rows(path: str) -> list[dict[str, str]]:
    csv_path = Path(path)
    if not csv_path.exists():
        raise ValueError(f"CSV file not found: {path}")
    with csv_path.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            return []
        return [{k: _norm(v) for k, v in row.items()} for row in reader]


def _get_row_value(row: dict[str, str], aliases: list[str]) -> str:
    alias_map = {_norm_key(key): value for key, value in row.items()}
    for alias in aliases:
        value = alias_map.get(_norm_key(alias))
        if value is not None:
            return _norm(value)
    return ""


def _parse_float(raw: str, field_name: str) -> float:
    try:
        return float(raw)
    except Exception as exc:
        raise ValueError(f"Invalid {field_name}: '{raw}'") from exc


def _parse_int(raw: str, field_name: str) -> int:
    try:
        return int(raw)
    except Exception as exc:
        raise ValueError(f"Invalid {field_name}: '{raw}'") from exc


def _merge_party_type(existing: str, incoming: str) -> str:
    if existing == incoming:
        return existing
    return "BOTH"


def _resolve_ids(conn) -> tuple[dict[str, int], dict[str, int]]:
    shed_rows = conn.execute("SELECT id, name FROM sheds").fetchall()
    item_rows = conn.execute("SELECT id, name FROM feed_items").fetchall()
    shed_id_by_name = {_norm_key(row["name"]): int(row["id"]) for row in shed_rows}
    item_id_by_name = {_norm_key(row["name"]): int(row["id"]) for row in item_rows}
    return shed_id_by_name, item_id_by_name


def _choose_baseline_date(conn) -> int:
    max_row = conn.execute("SELECT MAX(reportDate) AS maxDate FROM daily_reports").fetchone()
    today = int(date.today().strftime("%Y%m%d"))
    if not max_row or max_row["maxDate"] is None:
        return today
    max_date = int(max_row["maxDate"])
    return max(today, max_date + 1)


def _today_int() -> int:
    return int(date.today().strftime("%Y%m%d"))


def _ensure_baseline_daily_report(conn, report_date: int) -> int:
    existing = conn.execute(
        "SELECT id FROM daily_reports WHERE reportDate = %s", (report_date,)
    ).fetchone()
    if existing:
        return int(existing["id"])
    user_row = conn.execute("SELECT id FROM users ORDER BY id LIMIT 1").fetchone()
    if not user_row:
        raise ValueError("No users found. Seed users before running CSV initialization.")
    cur = conn.execute(
        """
        INSERT INTO daily_reports (reportDate, createdByUserId, status, submittedAt, createdAt, updatedAt)
        VALUES (%s, %s, 'LOCKED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
        """,
        (report_date, int(user_row["id"])),
    )
    return int(cur.fetchone()["id"])


def _replace_parties_if_allowed(conn) -> None:
    sales_count = int(conn.execute("SELECT COUNT(*) AS c FROM sales").fetchone()["c"])
    receipts_count = int(
        conn.execute("SELECT COUNT(*) AS c FROM feed_receipts").fetchone()["c"]
    )
    if sales_count > 0 or receipts_count > 0:
        raise ValueError(
            "Cannot replace parties: sales/feed receipts already exist. Clear transactional data first."
        )
    conn.execute("DELETE FROM parties")


def _clear_reports_from_baseline(conn, baseline_date: int) -> None:
    report_rows = conn.execute(
        "SELECT id FROM daily_reports WHERE reportDate >= %s",
        (baseline_date,),
    ).fetchall()
    report_ids = [int(row["id"]) for row in report_rows]
    if report_ids:
        placeholders = ",".join("%s" for _ in report_ids)
        conn.execute(
            f"DELETE FROM daily_reports WHERE id IN ({placeholders})",
            report_ids,
        )
    conn.execute(
        "DELETE FROM feed_item_daily_stock WHERE reportDate >= %s",
        (baseline_date,),
    )


def import_production_standards(conn, csv_path: str, dry_run: bool = False) -> ImportStats:
    std_stats = ImportStats()
    rows = _read_csv_rows(csv_path)

    for idx, row in enumerate(rows, start=2):
        week_raw = _get_row_value(row, ["week", "age_week"])
        prod_raw = _get_row_value(row, ["production_standard", "production"])
        feed_consumption_raw = _get_row_value(
            row, ["feed_standard", "feed/bird", "standard_feed_consumption"]
        )
        if not week_raw and not prod_raw and not feed_consumption_raw:
            std_stats.skipped += 1
            continue
        try:
            week = _parse_int(week_raw, "week")
            production_pct = _parse_float(prod_raw, "production_standard")
            feed_consumption = _parse_float(feed_consumption_raw, "feed_standard")
            existing = conn.execute(
                "SELECT id, standardProductionPct, standardFeedConsumption FROM production_standards WHERE week = %s",
                (week,),
            ).fetchone()
            if existing:
                prev_prod = float(existing["standardProductionPct"] or 0)
                prev_feed = float(existing["standardFeedConsumption"] or 0)
                if prev_prod == production_pct and prev_feed == feed_consumption:
                    std_stats.skipped += 1
                else:
                    if not dry_run:
                        conn.execute(
                            """
                            UPDATE production_standards
                            SET standardProductionPct = %s, standardFeedConsumption = %s, updatedAt = CURRENT_TIMESTAMP
                            WHERE id = %s
                            """,
                            (production_pct, feed_consumption, int(existing["id"])),
                        )
                    std_stats.updated += 1
            else:
                if not dry_run:
                    conn.execute(
                        """
                        INSERT INTO production_standards (week, standardProductionPct, standardFeedConsumption)
                        VALUES (%s, %s, %s)
                        """,
                        (week, production_pct, feed_consumption),
                    )
                std_stats.inserted += 1
        except ValueError as exc:
            std_stats.errors.append(f"Line {idx}: {exc}")

    return std_stats


def import_parties(conn, csv_path: str, party_type: str, dry_run: bool = False) -> ImportStats:
    stats = ImportStats()
    rows = _read_csv_rows(csv_path)
    for idx, row in enumerate(rows, start=2):
        name = _get_row_value(row, ["name", "party_name", "party"])
        if not name:
            stats.skipped += 1
            continue
        phone = _get_row_value(row, ["phone", "contact", "mobile"])
        address = _get_row_value(row, ["address", "location"])
        existing = conn.execute(
            "SELECT id, type, phone, address FROM parties WHERE lower(name) = lower(%s)",
            (name,),
        ).fetchone()
        if existing:
            merged_type = _merge_party_type(str(existing["type"]), party_type)
            if (
                merged_type == str(existing["type"])
                and _norm(existing["phone"]) == phone
                and _norm(existing["address"]) == address
            ):
                stats.skipped += 1
                continue
            if not dry_run:
                conn.execute(
                    """
                    UPDATE parties
                    SET type = %s, phone = %s, address = %s, updatedAt = CURRENT_TIMESTAMP
                    WHERE id = %s
                    """,
                    (merged_type, phone or None, address or None, int(existing["id"])),
                )
            stats.updated += 1
        else:
            if not dry_run:
                conn.execute(
                    """
                    INSERT INTO parties (name, type, phone, address)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (name, party_type, phone or None, address or None),
                )
            stats.inserted += 1
    return stats


def import_feed_formulations(conn, csv_path: str, dry_run: bool = False) -> ImportStats:
    stats = ImportStats()
    rows = _read_csv_rows(csv_path)
    shed_id_by_name, item_id_by_name = _resolve_ids(conn)

    if not rows:
        return stats

    first_row_keys = list(rows[0].keys())
    item_col = ""
    for key in first_row_keys:
        if _norm_key(key) in {"itemname", "feedname", "feeditem", "item"}:
            item_col = key
            break
    if not item_col:
        stats.errors.append("Header row must contain 'Item Name'.")
        return stats

    shed_columns = [k for k in first_row_keys if k != item_col and _norm(k)]
    for shed_col in shed_columns:
        if _norm_key(shed_col) not in shed_id_by_name:
            stats.errors.append(f"Unknown shed column '{shed_col}' in formulations CSV.")
            return stats

    for idx, row in enumerate(rows, start=2):
        item_name = _norm(row.get(item_col))
        item_key = _norm_key(item_name)
        if not item_name:
            stats.skipped += 1
            continue
        if item_key in {"medicines", "medicine", "ingredients", "ingredient", "total"}:
            stats.skipped += 1
            continue
        try:
            float(item_name)
            stats.skipped += 1
            continue
        except ValueError:
            pass

        item_id = item_id_by_name.get(item_key)
        if not item_id:
            stats.errors.append(f"Line {idx}: unknown feed item '{item_name}'.")
            continue

        for shed_col in shed_columns:
            ratio_raw = _norm(row.get(shed_col))
            if ratio_raw == "":
                continue
            try:
                ratio = _parse_float(ratio_raw, "ratio_per_1000kg")
            except ValueError as exc:
                stats.errors.append(f"Line {idx}, shed '{shed_col}': {exc}")
                continue
            shed_id = shed_id_by_name.get(_norm_key(shed_col))
            existing = conn.execute(
                "SELECT id, ratioPer1000Kg FROM feed_formulations WHERE shedId = %s AND feedItemId = %s",
                (shed_id, item_id),
            ).fetchone()
            if existing:
                if float(existing["ratioPer1000Kg"] or 0) == ratio:
                    stats.skipped += 1
                else:
                    if not dry_run:
                        conn.execute(
                            """
                            UPDATE feed_formulations
                            SET ratioPer1000Kg = %s, updatedAt = CURRENT_TIMESTAMP
                            WHERE id = %s
                            """,
                            (ratio, int(existing["id"])),
                        )
                    stats.updated += 1
            else:
                if not dry_run:
                    conn.execute(
                        """
                        INSERT INTO feed_formulations (shedId, feedItemId, ratioPer1000Kg)
                        VALUES (%s, %s, %s)
                        """,
                        (shed_id, item_id, ratio),
                    )
                stats.inserted += 1
    return stats


def apply_feed_closing_baseline(
    conn, csv_path: str, report_date: int, dry_run: bool = False
) -> tuple[ImportStats, ImportStats]:
    stats = ImportStats()
    feed_item_stats = ImportStats()
    rows = _read_csv_rows(csv_path)
    _, item_id_by_name = _resolve_ids(conn)
    for idx, row in enumerate(rows, start=2):
        item_name = _get_row_value(row, ["feed_name", "feed_item", "name", "feed"])
        qty_raw = _get_row_value(row, ["closing_kg", "closing", "qty_kg", "quantity_kg"])
        if not item_name:
            stats.skipped += 1
            continue
        item_id = item_id_by_name.get(_norm_key(item_name))
        if not item_id:
            if not dry_run:
                cur = conn.execute(
                    "INSERT INTO feed_items (name, category) VALUES (%s, 'INGREDIENT') RETURNING id",
                    (item_name,),
                )
                item_id = int(cur.fetchone()["id"])
            else:
                item_id = -idx
            item_id_by_name[_norm_key(item_name)] = item_id
            feed_item_stats.inserted += 1
        try:
            closing = _parse_float(qty_raw, "closing_kg")
        except ValueError as exc:
            stats.errors.append(f"Line {idx}: {exc}")
            continue
        existing = conn.execute(
            """
            SELECT id, closingKg FROM feed_item_daily_stock
            WHERE reportDate = %s AND feedItemId = %s
            """,
            (report_date, item_id),
        ).fetchone()
        if existing:
            if float(existing["closingKg"] or 0) == closing:
                stats.skipped += 1
            else:
                if not dry_run:
                    conn.execute(
                        """
                        UPDATE feed_item_daily_stock
                        SET openingKg = %s, receiptsKg = 0, usedKg = 0, closingKg = %s, updatedAt = CURRENT_TIMESTAMP
                        WHERE id = %s
                        """,
                        (closing, closing, int(existing["id"])),
                    )
                stats.updated += 1
        else:
            if not dry_run:
                conn.execute(
                    """
                    INSERT INTO feed_item_daily_stock (
                      reportDate, feedItemId, openingKg, receiptsKg, usedKg, closingKg, createdAt, updatedAt
                    ) VALUES (%s, %s, %s, 0, 0, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """,
                    (report_date, item_id, closing, closing),
                )
            stats.inserted += 1
    return stats, feed_item_stats


def apply_shed_closing_baseline(
    conn, csv_path: str, report_date: int, dry_run: bool = False
) -> tuple[ImportStats, int]:
    stats = ImportStats()
    rows = _read_csv_rows(csv_path)
    shed_id_by_name, _ = _resolve_ids(conn)
    baseline_report_id = _ensure_baseline_daily_report(conn, report_date)
    for idx, row in enumerate(rows, start=2):
        shed_name = _get_row_value(row, ["shed_name", "shed"])
        if not shed_name:
            stats.skipped += 1
            continue
        shed_id = shed_id_by_name.get(_norm_key(shed_name))
        if not shed_id:
            stats.errors.append(f"Line {idx}: unknown shed '{shed_name}'.")
            continue
        try:
            closing_birds = _parse_int(
                _get_row_value(row, ["closing_birds", "birds_closing", "birds"]),
                "closing_birds",
            )
            std_eggs = _parse_int(
                _get_row_value(row, ["standard_eggs_closing", "standard_eggs", "std_eggs"]),
                "standard_eggs_closing",
            )
            small_eggs = _parse_int(
                _get_row_value(row, ["small_eggs_closing", "small_eggs"]), "small_eggs_closing"
            )
            big_eggs = _parse_int(
                _get_row_value(row, ["big_eggs_closing", "big_eggs"]), "big_eggs_closing"
            )
            closing_feed = _parse_float(
                _get_row_value(row, ["feed_closing", "closing_feed", "closing_feed_kg"]),
                "feed_closing",
            )
        except ValueError as exc:
            stats.errors.append(f"Line {idx}: {exc}")
            continue
        total_eggs = std_eggs + small_eggs + big_eggs
        existing = conn.execute(
            """
            SELECT id, closingBirds, totalEggsClosing, feedClosing
            FROM shed_daily_reports
            WHERE dailyReportId = %s AND shedId = %s
            """,
            (baseline_report_id, shed_id),
        ).fetchone()
        if existing:
            if (
                int(existing["closingBirds"] or 0) == closing_birds
                and int(existing["totalEggsClosing"] or 0) == total_eggs
                and float(existing["feedClosing"] or 0) == closing_feed
            ):
                stats.skipped += 1
            else:
                if not dry_run:
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
                            closing_feed,
                            closing_feed,
                            int(existing["id"]),
                        ),
                    )
                stats.updated += 1
        else:
            if not dry_run:
                conn.execute(
                    """
                    INSERT INTO shed_daily_reports (
                      dailyReportId, shedId, openingBirds, birdsMortality, closingBirds, openingEggs, damagedEggs,
                      standardEggsClosing, smallEggsClosing, bigEggsClosing,
                      feedOpening, feedIssued, feedClosing, feedConsumed, totalEggsClosing, eggsProduced,
                      totalFeedReceipt, closingFeed, createdAt, updatedAt
                    ) VALUES (%s, %s, %s, 0, %s, 0, 0, %s, %s, %s, %s, 0, %s, 0, %s, 0, 0, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """,
                    (
                        baseline_report_id,
                        shed_id,
                        closing_birds,
                        closing_birds,
                        std_eggs,
                        small_eggs,
                        big_eggs,
                        closing_feed,
                        closing_feed,
                        total_eggs,
                        closing_feed,
                    ),
                )
            stats.inserted += 1
    return stats, baseline_report_id


def run_csv_initialization(
    *,
    production_standards_csv: str,
    formulations_csv: str,
    buyers_csv: str,
    sellers_csv: str,
    feed_closing_csv: str,
    shed_closing_csv: str,
    replace_parties: bool = False,
    clear_from_baseline: bool = False,
    dry_run: bool = False,
) -> dict:
    with get_connection() as conn:
        write_mode = True
        baseline_date = _today_int() if clear_from_baseline else _choose_baseline_date(conn)
        if clear_from_baseline:
            _clear_reports_from_baseline(conn, baseline_date)
        if replace_parties:
            _replace_parties_if_allowed(conn)
        standards_stats = import_production_standards(
            conn, production_standards_csv, dry_run=not write_mode
        )
        buyer_stats = import_parties(conn, buyers_csv, "CUSTOMER", dry_run=not write_mode)
        seller_stats = import_parties(conn, sellers_csv, "SUPPLIER", dry_run=not write_mode)
        feed_closing_stats, feed_item_stats = apply_feed_closing_baseline(
            conn, feed_closing_csv, baseline_date, dry_run=not write_mode
        )
        formulation_stats = import_feed_formulations(
            conn, formulations_csv, dry_run=not write_mode
        )
        shed_closing_stats, baseline_report_id = apply_shed_closing_baseline(
            conn, shed_closing_csv, baseline_date, dry_run=not write_mode
        )
        if dry_run:
            conn.rollback()
        else:
            conn.commit()

    result = {
        "baselineDate": baseline_date,
        "baselineDailyReportId": baseline_report_id,
        "feedItems": feed_item_stats.as_dict(),
        "productionStandards": standards_stats.as_dict(),
        "buyers": buyer_stats.as_dict(),
        "sellers": seller_stats.as_dict(),
        "feedFormulations": formulation_stats.as_dict(),
        "feedClosingStock": feed_closing_stats.as_dict(),
        "shedsClosingValues": shed_closing_stats.as_dict(),
    }
    return result
