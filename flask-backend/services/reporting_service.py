from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
from tempfile import NamedTemporaryFile, gettempdir
from typing import Dict, List, Optional, Set, Tuple

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas

from db.connection import get_connection


DEFAULT_STANDARD_BY_WEEK: Dict[int, Tuple[float, float]] = {
    18: (0.0, 0.078),
    19: (3.0, 0.084),
    20: (15.0, 0.089),
    21: (44.5, 0.093),
    22: (67.6, 0.097),
    23: (82.4, 0.10),
    24: (91.1, 0.102),
    25: (94.8, 0.104),
    26: (95.6, 0.105),
    27: (96.1, 0.106),
    28: (96.4, 0.107),
    29: (96.6, 0.108),
    30: (96.7, 0.109),
    31: (96.8, 0.11),
    32: (97.0, 0.11),
    33: (96.9, 0.11),
    34: (96.8, 0.11),
    35: (96.7, 0.11),
    36: (96.6, 0.11),
    37: (96.5, 0.11),
    38: (96.4, 0.11),
    39: (96.2, 0.11),
    40: (96.1, 0.11),
    41: (95.9, 0.11),
    42: (95.8, 0.11),
    43: (95.6, 0.11),
    44: (95.4, 0.11),
    45: (95.3, 0.11),
    46: (95.1, 0.11),
    47: (94.9, 0.11),
    48: (94.6, 0.11),
    49: (94.4, 0.11),
    50: (94.2, 0.11),
    51: (93.9, 0.11),
    52: (93.7, 0.11),
    53: (93.4, 0.11),
    54: (93.2, 0.11),
    55: (92.9, 0.11),
    56: (92.7, 0.11),
    57: (92.4, 0.11),
    58: (92.1, 0.11),
    59: (91.8, 0.11),
    60: (91.5, 0.11),
    61: (91.2, 0.11),
    62: (90.9, 0.11),
    63: (90.6, 0.11),
    64: (90.3, 0.11),
    65: (90.0, 0.11),
    66: (89.6, 0.11),
    67: (89.3, 0.11),
    68: (89.0, 0.11),
    69: (88.6, 0.11),
    70: (88.3, 0.11),
    71: (87.9, 0.11),
    72: (87.5, 0.11),
    73: (87.2, 0.11),
    74: (86.8, 0.11),
    75: (86.3, 0.11),
    76: (85.9, 0.11),
    77: (85.6, 0.11),
    78: (85.2, 0.11),
    79: (84.8, 0.11),
    80: (84.4, 0.11),
    81: (84.0, 0.11),
    82: (83.6, 0.11),
    83: (83.2, 0.11),
    84: (82.9, 0.11),
    85: (82.5, 0.11),
    86: (82.1, 0.11),
    87: (81.7, 0.11),
    88: (81.3, 0.11),
    89: (80.9, 0.11),
    90: (80.6, 0.11),
    91: (80.2, 0.11),
    92: (79.8, 0.11),
    93: (79.4, 0.11),
    94: (79.1, 0.11),
    95: (78.7, 0.11),
    96: (78.3, 0.11),
    97: (78.0, 0.11),
    98: (77.7, 0.11),
    99: (77.3, 0.11),
    100: (77.0, 0.11),
}


def _load_standard_by_week() -> Dict[int, Tuple[float, float]]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT week, standardProductionPct, standardFeedConsumption
            FROM production_standards
            ORDER BY week
            """
        ).fetchall()
    if not rows:
        return DEFAULT_STANDARD_BY_WEEK
    standards: Dict[int, Tuple[float, float]] = {}
    for row in rows:
        standards[int(row["week"])] = (
            float(row["standardProductionPct"] or 0),
            float(row["standardFeedConsumption"] or 0),
        )
    return standards


def _safe_div(numerator: Optional[float], denominator: Optional[float]) -> Optional[float]:
    if numerator is None or denominator is None or denominator == 0:
        return None
    return numerator / denominator


def _to_date(report_date: int) -> date:
    s = str(report_date)
    return date(int(s[0:4]), int(s[4:6]), int(s[6:8]))


def _load_flock_metadata() -> Dict[int, dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT shedId, flockNumber, birthDate FROM shed_flock_metadata"
        ).fetchall()
    return {int(r["shedId"]): dict(r) for r in rows}


def _load_previous_shed_map(report_date_yyyymmdd: int) -> Dict[int, dict]:
    prev = _to_date(report_date_yyyymmdd).fromordinal(_to_date(report_date_yyyymmdd).toordinal() - 1)
    prev_int = int(prev.strftime("%Y%m%d"))
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id FROM daily_reports WHERE reportDate = %s",
            (prev_int,),
        ).fetchone()
        if not row:
            return {}
        rows = conn.execute(
            """
            SELECT shedId, closingBirds, birdsMortality, totalEggsClosing, feedClosing, closingFeed, eggsProduced
            FROM shed_daily_reports WHERE dailyReportId = %s
            """,
            (row["id"],),
        ).fetchall()
    return {int(r["shedId"]): dict(r) for r in rows}


def _format_number(value: Optional[float], digits: int = 0) -> str:
    if value is None:
        return ""
    if digits == 0:
        return str(int(round(value)))
    return f"{value:.{digits}f}"


def _sum_numeric(values: List[Optional[float]]) -> Optional[float]:
    valid = [v for v in values if v is not None]
    if not valid:
        return None
    return sum(valid)


def _build_report1_matrix(report_payload: dict) -> Tuple[List[str], List[List[str]]]:
    report_date = int(report_payload["reportDate"])
    report_day = _to_date(report_date)
    flock_meta = _load_flock_metadata()
    prev_map = _load_previous_shed_map(report_date)
    standard_by_week = _load_standard_by_week()

    shed_reports = report_payload.get("shedDailyReports", []) or []
    shed_reports_sorted = sorted(shed_reports, key=lambda x: x["shed"]["name"])

    shed_headers = [s["shed"]["name"] for s in shed_reports_sorted]
    columns = ["Row"] + shed_headers + ["Total"]

    sales_by_shed = {}
    for sale in report_payload.get("sales", []) or []:
        for item in sale.get("items", []) or []:
            sid = int(item["shedId"])
            agg = sales_by_shed.setdefault(sid, {"soldEggs": 0.0, "loadingDamage": 0.0})
            agg["soldEggs"] += (
                float(item.get("standardEggs") or 0)
                + float(item.get("smallEggs") or 0)
                + float(item.get("bigEggs") or 0)
            )
            agg["loadingDamage"] += float(item.get("loadingDamage") or 0)

    per_shed = []
    for row in shed_reports_sorted:
        shed = row["shed"]
        sid = int(shed["id"])
        prev = prev_map.get(sid, {})
        sales = sales_by_shed.get(sid, {"soldEggs": 0.0, "loadingDamage": 0.0})
        flock = flock_meta.get(sid, {})

        opening_birds = prev.get("closingBirds")
        mortality = row.get("birdsMortality")
        closing_birds = row.get("closingBirds")
        mortality_pct = _safe_div(float(mortality or 0), float(opening_birds or 0))
        opening_eggs = prev.get("totalEggsClosing")
        if opening_eggs is None:
            opening_eggs = 0
        closing_eggs = (
            float(row.get("standardEggsClosing") or 0)
            + float(row.get("smallEggsClosing") or 0)
            + float(row.get("bigEggsClosing") or 0)
        )
        produced_eggs = row.get("eggsProduced")
        if produced_eggs is None:
            produced_eggs = (
                closing_eggs - float(opening_eggs or 0) + sales["soldEggs"] + sales["loadingDamage"]
            )
        damaged_eggs = float(row.get("damagedEggs") or 0)
        sold_eggs = sales["soldEggs"]
        damaged_eggs_pct = _safe_div(damaged_eggs, float(produced_eggs or 0))
        actual_prod_pct = _safe_div(float(produced_eggs or 0), float(opening_birds or 0))

        prev_opening_birds = None
        if prev:
            prev_opening_birds = (prev.get("closingBirds") or 0) + (prev.get("birdsMortality") or 0)
        prev_actual_prod = _safe_div(float(prev.get("eggsProduced") or 0), float(prev_opening_birds or 0))
        prod_diff_yesterday = None
        if actual_prod_pct is not None and prev_actual_prod is not None:
            prod_diff_yesterday = actual_prod_pct - prev_actual_prod

        birth_date = flock.get("birthDate")
        age_week = None
        age_display = ""
        if birth_date:
            birth = datetime.strptime(birth_date, "%Y-%m-%d").date()
            age_days = (report_day - birth).days
            if age_days >= 0:
                age_week = age_days // 7
                age_display = f"Week {age_week} Day {age_days % 7}"

        std_prod = None
        std_feed = None
        if age_week in standard_by_week:
            std_prod, std_feed = standard_by_week[age_week]
            std_prod /= 100.0

        std_prod_diff = None
        if actual_prod_pct is not None and std_prod is not None:
            std_prod_diff = actual_prod_pct - std_prod

        opening_feed = row.get("feedOpening")
        if opening_feed is None:
            opening_feed = prev.get("feedClosing") or prev.get("closingFeed")
        issued_feed = row.get("feedIssued")
        feed_consumed = row.get("feedConsumed")
        feed_cons_per_bird = _safe_div(float(feed_consumed or 0), float(opening_birds or 0))
        closing_feed = row.get("feedClosing")

        per_shed.append(
            {
                "flockNo": flock.get("flockNumber") or shed.get("flockNumber") or "",
                "shed": shed.get("name", ""),
                "shedCapacity": shed.get("capacity"),
                "age": age_display,
                "openingBirds": opening_birds,
                "mortality": mortality,
                "mortalityPct": mortality_pct,
                "closingBirds": closing_birds,
                "openingEggs": opening_eggs,
                "producedEggs": produced_eggs,
                "damagedEggs": damaged_eggs,
                "soldEggs": sold_eggs,
                "closingEggs": closing_eggs,
                "damagedEggsPct": damaged_eggs_pct,
                "actualProdPct": actual_prod_pct,
                "prodDiffYesterday": prod_diff_yesterday,
                "stdProdPct": std_prod,
                "stdProdDiff": std_prod_diff,
                "openingFeed": opening_feed,
                "issuedFeed": issued_feed,
                "feedConsumedKgs": feed_consumed,
                "feedConsPerBird": feed_cons_per_bird,
                "stdFeedCons": std_feed,
                "closingFeed": closing_feed,
            }
        )

    row_def = [
        ("Flock No", "flockNo", "text"),
        ("Shed", "shed", "text"),
        ("Shed Capacity", "shedCapacity", "int"),
        ("Age", "age", "text"),
        ("Opening Birds", "openingBirds", "int"),
        ("Mortality", "mortality", "int"),
        ("Mortality %", "mortalityPct", "pct"),
        ("Closing Birds", "closingBirds", "int"),
        ("Opening Eggs", "openingEggs", "int"),
        ("Produced Eggs", "producedEggs", "int"),
        ("Damaged Eggs", "damagedEggs", "int"),
        ("Sold Eggs", "soldEggs", "int"),
        ("Closing Eggs", "closingEggs", "int"),
        ("Damaged Eggs %", "damagedEggsPct", "pct"),
        ("Actual Production %", "actualProdPct", "pct"),
        ("Production % diff from yesterday", "prodDiffYesterday", "pct_signed"),
        ("Standard Production %", "stdProdPct", "pct"),
        ("Standard Production difference", "stdProdDiff", "pct_signed"),
        ("Opening Feed", "openingFeed", "int"),
        ("Issued Feed", "issuedFeed", "int"),
        ("Feed Consumption in Kgs", "feedConsumedKgs", "int"),
        ("Feed Consumption/bird", "feedConsPerBird", "float"),
        ("Standard Feed Consumption", "stdFeedCons", "float"),
        ("Closing Feed", "closingFeed", "int"),
    ]

    matrix: List[List[str]] = []
    for title, key, kind in row_def:
        vals: List[Optional[float]] = []
        rendered: List[str] = []
        for s in per_shed:
            v = s.get(key)
            if kind == "text":
                rendered.append(str(v or ""))
            elif kind in ("pct", "pct_signed"):
                vals.append(v if isinstance(v, (int, float)) else None)
                rendered.append("" if v is None else f"{(v * 100):.3f}")
            elif kind == "float":
                vals.append(v if isinstance(v, (int, float)) else None)
                rendered.append(_format_number(v, 3))
            else:
                vals.append(v if isinstance(v, (int, float)) else None)
                rendered.append(_format_number(v, 0))
        total_cell = ""
        if kind == "text":
            total_cell = ""
        elif kind in ("pct", "pct_signed", "float"):
            total = _sum_numeric(vals)
            total_cell = "" if total is None else (
                f"{(total * 100):.3f}" if kind in ("pct", "pct_signed") else _format_number(total, 3)
            )
        else:
            total = _sum_numeric(vals)
            total_cell = _format_number(total, 0)
        matrix.append([title] + rendered + [total_cell])

    return columns, matrix


def _build_report1_data(
    report_payload: dict,
) -> Tuple[List[str], List[List[str]], List[dict]]:
    columns, matrix = _build_report1_matrix(report_payload)
    report_date = int(report_payload["reportDate"])
    report_day = _to_date(report_date)
    flock_meta = _load_flock_metadata()
    prev_map = _load_previous_shed_map(report_date)
    standard_by_week = _load_standard_by_week()

    shed_reports = report_payload.get("shedDailyReports", []) or []
    shed_reports_sorted = sorted(shed_reports, key=lambda x: x["shed"]["name"])

    sales_by_shed = {}
    for sale in report_payload.get("sales", []) or []:
        for item in sale.get("items", []) or []:
            sid = int(item["shedId"])
            agg = sales_by_shed.setdefault(sid, {"soldEggs": 0.0, "loadingDamage": 0.0})
            agg["soldEggs"] += (
                float(item.get("standardEggs") or 0)
                + float(item.get("smallEggs") or 0)
                + float(item.get("bigEggs") or 0)
            )
            agg["loadingDamage"] += float(item.get("loadingDamage") or 0)

    per_shed: List[dict] = []
    for row in shed_reports_sorted:
        shed = row["shed"]
        sid = int(shed["id"])
        prev = prev_map.get(sid, {})
        sales = sales_by_shed.get(sid, {"soldEggs": 0.0, "loadingDamage": 0.0})
        flock = flock_meta.get(sid, {})

        opening_birds = prev.get("closingBirds")
        mortality = row.get("birdsMortality")
        mortality_pct = _safe_div(float(mortality or 0), float(opening_birds or 0))
        opening_eggs = prev.get("totalEggsClosing") or 0
        closing_eggs = (
            float(row.get("standardEggsClosing") or 0)
            + float(row.get("smallEggsClosing") or 0)
            + float(row.get("bigEggsClosing") or 0)
        )
        produced_eggs = row.get("eggsProduced")
        if produced_eggs is None:
            produced_eggs = (
                closing_eggs - float(opening_eggs or 0) + sales["soldEggs"] + sales["loadingDamage"]
            )
        actual_prod_pct = _safe_div(float(produced_eggs or 0), float(opening_birds or 0))

        prev_opening_birds = None
        if prev:
            prev_opening_birds = (prev.get("closingBirds") or 0) + (prev.get("birdsMortality") or 0)
        prev_actual_prod = _safe_div(float(prev.get("eggsProduced") or 0), float(prev_opening_birds or 0))
        prod_diff_yesterday = None
        if actual_prod_pct is not None and prev_actual_prod is not None:
            prod_diff_yesterday = actual_prod_pct - prev_actual_prod

        birth_date = flock.get("birthDate")
        age_week = None
        if birth_date:
            birth = datetime.strptime(birth_date, "%Y-%m-%d").date()
            age_days = (report_day - birth).days
            if age_days >= 0:
                age_week = age_days // 7

        std_prod = None
        std_feed = None
        if age_week in standard_by_week:
            std_prod, std_feed = standard_by_week[age_week]
            std_prod /= 100.0

        std_prod_diff = None
        if actual_prod_pct is not None and std_prod is not None:
            std_prod_diff = actual_prod_pct - std_prod

        feed_consumed = row.get("feedConsumed")
        feed_cons_per_bird = _safe_div(float(feed_consumed or 0), float(opening_birds or 0))
        per_shed.append(
            {
                "shedName": shed.get("name", ""),
                "mortality": float(mortality or 0),
                "mortalityPct": mortality_pct,
                "actualProdPct": actual_prod_pct,
                "stdProdPct": std_prod,
                "prodDiffYesterday": prod_diff_yesterday,
                "stdProdDiff": std_prod_diff,
                "feedConsPerBird": feed_cons_per_bird,
                "stdFeedCons": std_feed,
            }
        )
    return columns, matrix, per_shed


def _build_report2_matrix(report_payload: dict) -> Tuple[List[str], List[List[str]]]:
    report_date = int(report_payload.get("reportDate") or 0)
    shed_reports = sorted(
        report_payload.get("shedDailyReports", []) or [],
        key=lambda x: x["shed"]["name"],
    )
    sheds = [(int(row["shed"]["id"]), row["shed"]["name"]) for row in shed_reports]
    issued_by_shed = {
        int(row["shed"]["id"]): float(row.get("feedIssued") or 0) for row in shed_reports
    }

    with get_connection() as conn:
        feed_items = conn.execute(
            "SELECT id, name FROM feed_items ORDER BY name"
        ).fetchall()
        stock_rows = conn.execute(
            """
            SELECT feedItemId, openingKg, receiptsKg, usedKg, closingKg
            FROM feed_item_daily_stock
            WHERE reportDate = %s
            """,
            (report_date,),
        ).fetchall()
        formulations = conn.execute(
            """
            SELECT shedId, feedItemId, ratioPer1000Kg
            FROM feed_formulations
            """
        ).fetchall()

    stock_by_item = {
        int(row["feedItemId"]): {
            "opening": float(row["openingKg"] or 0),
            "receipts": float(row["receiptsKg"] or 0),
            "used": float(row["usedKg"] or 0),
            "closing": float(row["closingKg"] or 0),
        }
        for row in stock_rows
    }
    ratio_by_pair = {
        (int(row["shedId"]), int(row["feedItemId"])): float(row["ratioPer1000Kg"] or 0)
        for row in formulations
    }
    formulated_feed_item_ids = {int(row["feedItemId"]) for row in formulations}

    columns = (
        ["Item Name", "Opening (kg)", "Receipts (kg)"]
        + [f"{shed_name} Used (kg)" for _, shed_name in sheds]
        + ["Total Used (kg)", "Closing (kg)"]
    )
    matrix: List[List[str]] = []

    totals = {
        "opening": 0.0,
        "receipts": 0.0,
        "used": 0.0,
        "closing": 0.0,
    }
    shed_totals: Dict[int, float] = {shed_id: 0.0 for shed_id, _ in sheds}

    for item in feed_items:
        item_id = int(item["id"])
        item_name = str(item["name"])
        stock = stock_by_item.get(
            item_id, {"opening": 0.0, "receipts": 0.0, "used": 0.0, "closing": 0.0}
        )
        # Hide non-relevant rows: no opening stock and not in formulations.
        if stock["opening"] == 0 and item_id not in formulated_feed_item_ids:
            continue
        per_shed_usage = []
        for shed_id, _ in sheds:
            ratio = float(ratio_by_pair.get((shed_id, item_id), 0))
            issued = float(issued_by_shed.get(shed_id, 0))
            used = issued * ratio / 1000.0
            per_shed_usage.append(used)
            shed_totals[shed_id] += used

        row = [
            item_name,
            _format_number(stock["opening"], 2),
            _format_number(stock["receipts"], 2),
        ]
        row.extend(_format_number(value, 2) for value in per_shed_usage)
        row.append(_format_number(stock["used"], 2))
        row.append(_format_number(stock["closing"], 2))
        matrix.append(row)

        totals["opening"] += stock["opening"]
        totals["receipts"] += stock["receipts"]
        totals["used"] += stock["used"]
        totals["closing"] += stock["closing"]

    total_row = [
        "Total",
        _format_number(totals["opening"], 2),
        _format_number(totals["receipts"], 2),
    ]
    total_row.extend(_format_number(shed_totals[shed_id], 2) for shed_id, _ in sheds)
    total_row.append(_format_number(totals["used"], 2))
    total_row.append(_format_number(totals["closing"], 2))
    matrix.append(total_row)
    return columns, matrix


def _is_numeric_text(value: str) -> bool:
    try:
        float((value or "").replace(",", ""))
        return True
    except Exception:
        return False


def _build_warning_messages(report_payload: dict, per_shed: List[dict]) -> List[str]:
    warnings: List[str] = []

    for shed in per_shed:
        shed_name = shed["shedName"]
        prod_drop = shed.get("prodDiffYesterday")
        if isinstance(prod_drop, (int, float)) and prod_drop < -0.02:
            warnings.append(
                f"{abs(prod_drop) * 100:.2f}% production drop in {shed_name}."
            )

        mortality_pct = shed.get("mortalityPct")
        mortality = shed.get("mortality")
        if isinstance(mortality_pct, (int, float)) and mortality_pct > 0.0002:
            warnings.append(f"{int(round(mortality or 0))} birds mortality in {shed_name}.")

        std_diff = shed.get("stdProdDiff")
        if isinstance(std_diff, (int, float)) and std_diff < -0.05:
            warnings.append(
                f"Production% in {shed_name} is {abs(std_diff) * 100:.2f}% less than standard."
            )

        actual_feed = shed.get("feedConsPerBird")
        std_feed = shed.get("stdFeedCons")
        if isinstance(actual_feed, (int, float)) and isinstance(std_feed, (int, float)) and std_feed > 0:
            feed_delta = (actual_feed - std_feed) / std_feed
            if feed_delta < -0.10:
                warnings.append(
                    f"Feed consumption per bird in {shed_name} is {abs(feed_delta) * 100:.2f}% less than standard."
                )

    report_date = int(report_payload.get("reportDate") or 0)
    shed_ids = [int(s["shed"]["id"]) for s in (report_payload.get("shedDailyReports", []) or [])]
    if shed_ids:
        placeholders = ",".join("%s" for _ in shed_ids)
        with get_connection() as conn:
            formulations = conn.execute(
                f"""
                SELECT feedItemId, ratioPer1000Kg
                FROM feed_formulations
                WHERE shedId IN ({placeholders})
                """,
                shed_ids,
            ).fetchall()
            stock_rows = conn.execute(
                """
                SELECT fis.feedItemId, fis.closingKg, fi.name
                FROM feed_item_daily_stock fis
                JOIN feed_items fi ON fi.id = fis.feedItemId
                WHERE fis.reportDate = %s
                """,
                (report_date,),
            ).fetchall()

        demand_by_item: Dict[int, float] = {}
        for row in formulations:
            item_id = int(row["feedItemId"])
            ratio = float(row["ratioPer1000Kg"] or 0)
            daily_demand = 5000.0 * ratio / 1000.0
            if daily_demand <= 0:
                continue
            demand_by_item[item_id] = demand_by_item.get(item_id, 0.0) + daily_demand

        stock_by_item = {
            int(row["feedItemId"]): (str(row["name"]), float(row["closingKg"] or 0))
            for row in stock_rows
        }
        for item_id, daily_demand in demand_by_item.items():
            if daily_demand <= 0:
                continue
            item_name, closing_kg = stock_by_item.get(item_id, ("Unknown item", 0.0))
            days_left = closing_kg / daily_demand if daily_demand else 0
            if days_left < 7:
                warnings.append(f"{item_name} is expected to run out in {days_left:.1f} days.")

    return warnings


# Top margin increased by ~60% from the previous setting.
_REPORT_PAGE_TOP_TITLE_Y_OFFSET = 48


def _format_display_date(report_date: str) -> str:
    s = str(report_date or "").strip()
    if len(s) == 8 and s.isdigit():
        return f"{s[6:8]}/{s[4:6]}/{s[0:4]}"
    if "-" in s:
        try:
            d = datetime.strptime(s, "%Y-%m-%d").date()
            return d.strftime("%d/%m/%Y")
        except ValueError:
            return s
    return s


def _format_filename_date(report_date: str) -> str:
    display = _format_display_date(report_date)
    # '/' is not valid inside filesystem file names on macOS/Linux.
    return display.replace("/", "-")


def _draw_report_page_header(
    c: canvas.Canvas, width: float, height: float, report_date: str
) -> float:
    """Draw main title and bold date. Returns y coordinate for content below the header."""
    margin_x = 24
    top = height - _REPORT_PAGE_TOP_TITLE_Y_OFFSET
    display_date = _format_display_date(report_date)
    c.setFillColor(colors.HexColor("#111827"))
    c.setFont("Helvetica-Bold", 18)
    c.drawString(margin_x, top, "PMR FARMS DAILY REPORT")
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin_x, top - 16, f"Date: {display_date}")
    # Keep clear vertical separation before chart/table headings.
    return top - 16 - 22


def _split_feed_column_header(col: str) -> Tuple[str, str]:
    """Split feed plant column labels into two lines for readability."""
    s = str(col).strip()
    if s == "Item Name":
        return "Item", "Name"
    if s == "Opening (kg)":
        return "Opening", "(kg)"
    if s == "Receipts (kg)":
        return "Receipts", "(kg)"
    if s == "Closing (kg)":
        return "Closing", "(kg)"
    if s.endswith(" Used (kg)"):
        return s[: -len(" Used (kg)")].strip(), "Used (kg)"
    half = max(1, len(s) // 2)
    return s[:half], s[half:]


def _draw_grouped_bar_chart(
    c: canvas.Canvas, y: float, width: float, per_shed: List[dict]
) -> float:
    chart_height = 180
    left = 28
    right = width - 28
    bottom = y - chart_height

    c.setFillColor(colors.HexColor("#111827"))
    c.setFont("Helvetica-Bold", 12)
    c.drawString(left, y + 2, "Production vs Standard Production (%)")

    chart_items = [
        p for p in per_shed if isinstance(p.get("actualProdPct"), (int, float)) and p.get("actualProdPct", 0) > 0
    ]
    if not chart_items:
        c.setFont("Helvetica", 10)
        c.setFillColor(colors.HexColor("#6B7280"))
        c.drawString(left, y - 18, "No production data available for chart.")
        return bottom - 14

    c.setStrokeColor(colors.HexColor("#D1D5DB"))
    c.setLineWidth(0.6)
    c.line(left, bottom, right, bottom)
    c.line(left, bottom, left, bottom + 130)

    max_val = max(
        [
            (float(item.get("actualProdPct") or 0) * 100)
            for item in chart_items
        ]
        + [(float(item.get("stdProdPct") or 0) * 100) for item in chart_items]
        + [1]
    )
    scale = 120.0 / max_val
    group_w = max(36, int((right - left - 12) / max(1, len(chart_items))))
    bar_w = max(10, int(group_w * 0.28))
    x = left + 10
    for item in chart_items:
        actual = float(item.get("actualProdPct") or 0) * 100
        standard = float(item.get("stdProdPct") or 0) * 100
        a_h = actual * scale
        s_h = standard * scale

        c.setFillColor(colors.HexColor("#10B981"))
        c.rect(x, bottom, bar_w, a_h, fill=1, stroke=0)
        c.setFillColor(colors.HexColor("#3B82F6"))
        c.rect(x + bar_w + 4, bottom, bar_w, s_h, fill=1, stroke=0)

        # Percentage labels above bars.
        c.setFillColor(colors.HexColor("#065F46"))
        c.setFont("Helvetica-Bold", 7)
        c.drawCentredString(x + (bar_w / 2), bottom + a_h + 4, f"{actual:.1f}%")
        c.setFillColor(colors.HexColor("#1D4ED8"))
        c.drawCentredString(x + bar_w + 4 + (bar_w / 2), bottom + s_h + 4, f"{standard:.1f}%")

        c.setFillColor(colors.HexColor("#111827"))
        c.setFont("Helvetica", 7)
        c.drawCentredString(x + bar_w, bottom - 10, str(item["shedName"])[:10])
        x += group_w

    c.setFillColor(colors.HexColor("#10B981"))
    c.rect(left, y - 28, 10, 10, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#111827"))
    c.setFont("Helvetica", 8)
    c.drawString(left + 14, y - 26, "Actual %")
    c.setFillColor(colors.HexColor("#3B82F6"))
    c.rect(left + 76, y - 28, 10, 10, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#111827"))
    c.drawString(left + 90, y - 26, "Standard %")
    return bottom - 16


def _draw_warnings_panel(c: canvas.Canvas, y: float, width: float, warnings: List[str]) -> float:
    left = 28
    panel_width = width - 56
    row_h = 14
    title_h = 24
    body_rows = max(1, len(warnings))
    panel_height = title_h + (body_rows * row_h) + 10

    c.setFillColor(colors.HexColor("#F8FAFC"))
    c.roundRect(left, y - panel_height, panel_width, panel_height, 8, fill=1, stroke=0)
    c.setStrokeColor(colors.HexColor("#CBD5E1"))
    c.setLineWidth(0.9)
    c.roundRect(left, y - panel_height, panel_width, panel_height, 8, fill=0, stroke=1)
    c.setFillColor(colors.HexColor("#111827"))
    c.setFont("Helvetica-Bold", 12)
    c.drawString(left + 10, y - 16, "Warnings")

    c.setFont("Helvetica", 9)
    c.setFillColor(colors.HexColor("#B91C1C") if warnings else colors.HexColor("#065F46"))
    if warnings:
        line_y = y - 34
        for item in warnings:
            c.drawString(left + 14, line_y, f"- {item[:140]}")
            line_y -= row_h
    else:
        c.drawString(left + 14, y - 34, "No warnings")
    return y - panel_height - 14


def _draw_table_section(
    c: canvas.Canvas,
    y: float,
    width: float,
    height: float,
    title: str,
    columns: List[str],
    matrix: List[List[str]],
    highlight_rows: Optional[Set[str]] = None,
    report_date: Optional[str] = None,
    two_line_feed_headers: bool = False,
) -> float:
    left = 24
    table_width = width - 48
    row_height = 18
    header_row_height = 28 if two_line_feed_headers else 18
    first_col_width = max(120, int(table_width * 0.16))
    other_count = max(1, len(columns) - 1)
    other_col_width = max(68, int((table_width - first_col_width) / other_count))
    col_widths = [first_col_width] + [other_col_width] * (len(columns) - 1)
    used_width = sum(col_widths)
    col_widths[-1] += table_width - used_width
    highlight_rows = highlight_rows or set()

    c.setFillColor(colors.HexColor("#111827"))
    c.setFont("Helvetica-Bold", 12)
    c.drawString(left, y, title)
    c.setStrokeColor(colors.HexColor("#94A3B8"))
    c.setLineWidth(1.0)
    c.line(left, y - 3, left + table_width, y - 3)
    y -= 18

    def draw_header(y_pos: float) -> float:
        c.setFillColor(colors.HexColor("#E2E8F0"))
        c.rect(left, y_pos - header_row_height, table_width, header_row_height, fill=1, stroke=0)
        c.setFillColor(colors.HexColor("#111827"))
        c.setFont("Helvetica-Bold", 8.5)
        x = left
        for i, col in enumerate(columns):
            if two_line_feed_headers:
                c.setFont("Helvetica-Bold", 7.5)
                line1, line2 = _split_feed_column_header(col)
                if i == 0:
                    c.drawString(x + 5, y_pos - 11, line1[:22])
                    c.drawString(x + 5, y_pos - 21, line2[:22])
                else:
                    cx = x + col_widths[i] / 2
                    c.drawCentredString(cx, y_pos - 11, line1[:16])
                    c.drawCentredString(cx, y_pos - 21, line2[:16])
            else:
                c.setFont("Helvetica-Bold", 8.5)
                c.drawString(x + 5, y_pos - 12, str(col)[:26])
            x += col_widths[i]
        return y_pos - header_row_height

    y = draw_header(y)
    min_y_for_row = 40 + header_row_height
    for idx, row in enumerate(matrix):
        if y < min_y_for_row:
            c.showPage()
            if report_date is not None:
                y = _draw_report_page_header(c, width, height, report_date)
            else:
                y = height - _REPORT_PAGE_TOP_TITLE_Y_OFFSET - 30
            c.setFillColor(colors.HexColor("#111827"))
            c.setFont("Helvetica-Bold", 12)
            c.drawString(left, y, title)
            y -= 18
            c.setStrokeColor(colors.HexColor("#94A3B8"))
            c.setLineWidth(1.0)
            c.line(left, y - 3, left + table_width, y - 3)
            y -= 18
            y = draw_header(y)

        row_title = str(row[0] if row else "")
        if row_title in highlight_rows:
            c.setFillColor(colors.HexColor("#DCFCE7"))
        elif idx % 2 == 0:
            c.setFillColor(colors.HexColor("#F9FAFB"))
        else:
            c.setFillColor(colors.white)
        c.rect(left, y - row_height, table_width, row_height, fill=1, stroke=0)

        x = left
        for i in range(len(columns)):
            text = str(row[i] if i < len(row) else "")
            c.setFillColor(colors.HexColor("#111827"))
            if i == 0:
                c.setFont("Helvetica-Bold" if row_title == "Total" else "Helvetica", 8.2)
                c.drawString(x + 5, y - 12, text[:30])
            else:
                if _is_numeric_text(text):
                    c.setFont("Helvetica-Bold" if row_title == "Total" else "Helvetica", 8.2)
                    c.drawRightString(x + col_widths[i] - 5, y - 12, text[:18])
                else:
                    c.setFont("Helvetica", 8.2)
                    c.drawString(x + 5, y - 12, text[:18])
            x += col_widths[i]

        c.setStrokeColor(colors.HexColor("#E5E7EB"))
        c.setLineWidth(0.35)
        c.line(left, y - row_height, left + table_width, y - row_height)
        y -= row_height
    return y - 16


def _render_table_pdf(
    title: str,
    subtitle: str,
    columns: List[str],
    matrix: List[List[str]],
    highlight_rows: Optional[Set[str]] = None,
) -> str:
    temp_file = NamedTemporaryFile(prefix="pmr-report-", suffix=".pdf", delete=False)
    out_path = Path(temp_file.name)
    temp_file.close()

    c = canvas.Canvas(str(out_path), pagesize=landscape(A4))
    width, height = landscape(A4)

    margin_x = 24
    top = height - _REPORT_PAGE_TOP_TITLE_Y_OFFSET
    table_top = top - 42
    row_height = 20
    table_width = width - (2 * margin_x)

    # Header hierarchy for a cleaner modern look.
    c.setFillColor(colors.HexColor("#111827"))
    c.setFont("Helvetica-Bold", 18)
    c.drawString(margin_x, top, title)
    c.setFillColor(colors.HexColor("#4B5563"))
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin_x, top - 16, subtitle)

    first_col_width = max(120, int(table_width * 0.16))
    other_count = max(1, len(columns) - 1)
    other_col_width = max(68, int((table_width - first_col_width) / other_count))
    col_widths = [first_col_width] + [other_col_width] * (len(columns) - 1)
    used_width = sum(col_widths)
    col_widths[-1] += table_width - used_width

    def _draw_header(y_pos: float) -> float:
        c.setFillColor(colors.HexColor("#E5E7EB"))
        c.rect(margin_x, y_pos - row_height, table_width, row_height, fill=1, stroke=0)
        c.setFillColor(colors.HexColor("#111827"))
        c.setFont("Helvetica-Bold", 9)
        x_pos = margin_x
        for idx, col in enumerate(columns):
            c.drawString(x_pos + 6, y_pos - 13, str(col)[:28])
            x_pos += col_widths[idx]
        return y_pos - row_height

    y = _draw_header(table_top)
    highlight_rows = highlight_rows or set()

    for row_idx, row in enumerate(matrix):
        if y < 40:
            c.showPage()
            y = _draw_header(height - 40)

        row_title = str(row[0] if row else "")
        if row_title in highlight_rows:
            c.setFillColor(colors.HexColor("#DCFCE7"))  # soft-green
        elif row_idx % 2 == 0:
            c.setFillColor(colors.HexColor("#F9FAFB"))
        else:
            c.setFillColor(colors.white)
        c.rect(margin_x, y - row_height, table_width, row_height, fill=1, stroke=0)

        x_pos = margin_x
        for idx in range(len(columns)):
            text = str(row[idx] if idx < len(row) else "")
            col_width = col_widths[idx]
            c.setFillColor(colors.HexColor("#111827"))
            if idx == 0:
                c.setFont("Helvetica-Bold" if row_title == "Total" else "Helvetica", 8.5)
                c.drawString(x_pos + 6, y - 13, text[:30])
            else:
                if _is_numeric_text(text):
                    c.setFont("Helvetica-Bold" if row_title == "Total" else "Helvetica", 8.5)
                    c.drawRightString(x_pos + col_width - 6, y - 13, text[:20])
                else:
                    c.setFont("Helvetica", 8.5)
                    c.drawString(x_pos + 6, y - 13, text[:20])
            x_pos += col_width

        c.setStrokeColor(colors.HexColor("#E5E7EB"))
        c.setLineWidth(0.35)
        c.line(margin_x, y - row_height, margin_x + table_width, y - row_height)
        y -= row_height

    c.save()
    return str(out_path)


def generate_report_pdfs(report_payload: dict) -> List[str]:
    report_date = str(report_payload.get("reportDate", ""))
    columns1, matrix1, per_shed = _build_report1_data(report_payload)
    columns2, matrix2 = _build_report2_matrix(report_payload)
    warnings = _build_warning_messages(report_payload, per_shed)

    out_path = Path(gettempdir()) / f"PMR_Farms_report_{_format_filename_date(report_date)}.pdf"

    c = canvas.Canvas(str(out_path), pagesize=landscape(A4))
    width, height = landscape(A4)
    y = _draw_report_page_header(c, width, height, report_date)

    y = _draw_grouped_bar_chart(c, y, width, per_shed)
    if y < 110:
        c.showPage()
        y = _draw_report_page_header(c, width, height, report_date)
    y = _draw_warnings_panel(c, y, width, warnings)

    # Component 3 starts on a fresh page.
    c.showPage()
    y = _draw_report_page_header(c, width, height, report_date)
    y = _draw_table_section(
        c,
        y,
        width,
        height,
        "Sheds Report",
        columns1,
        matrix1,
        highlight_rows={"Closing Birds", "Closing Eggs", "Closing Feed"},
        report_date=report_date,
    )

    # Component 4 starts on a fresh page.
    c.showPage()
    y = _draw_report_page_header(c, width, height, report_date)
    y = _draw_table_section(
        c,
        y,
        width,
        height,
        "Feed Plant Report",
        columns2,
        matrix2,
        report_date=report_date,
        two_line_feed_headers=True,
    )
    c.save()
    return [str(out_path)]
