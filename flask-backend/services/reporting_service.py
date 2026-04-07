from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Dict, List, Optional, Tuple

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
            "SELECT id FROM daily_reports WHERE reportDate = ?",
            (prev_int,),
        ).fetchone()
        if not row:
            return {}
        rows = conn.execute(
            """
            SELECT shedId, closingBirds, birdsMortality, totalEggsClosing, feedClosing, closingFeed, eggsProduced
            FROM shed_daily_reports WHERE dailyReportId = ?
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
            WHERE reportDate = ?
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


def _render_table_pdf(title: str, subtitle: str, columns: List[str], matrix: List[List[str]]) -> str:
    temp_file = NamedTemporaryFile(prefix="pmr-report-", suffix=".pdf", delete=False)
    out_path = Path(temp_file.name)
    temp_file.close()

    c = canvas.Canvas(str(out_path), pagesize=landscape(A4))
    width, height = landscape(A4)

    c.setFont("Helvetica-Bold", 14)
    c.drawString(30, height - 30, title)
    c.setFont("Helvetica", 10)
    c.drawString(30, height - 46, subtitle)

    x_start = 30
    y = height - 70
    row_height = 16
    col_width = max(70, int((width - 60) / max(1, len(columns))))

    c.setFillColor(colors.lightgrey)
    c.rect(x_start, y - row_height + 3, col_width * len(columns), row_height, fill=1, stroke=0)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 8)
    for idx, col in enumerate(columns):
        c.drawString(x_start + idx * col_width + 2, y - 9, str(col)[:26])

    y -= row_height
    c.setFont("Helvetica", 8)
    for r in matrix:
        if y < 30:
            c.showPage()
            y = height - 30
            c.setFont("Helvetica", 8)
        for idx in range(len(columns)):
            text = r[idx] if idx < len(r) else ""
            c.drawString(x_start + idx * col_width + 2, y - 9, str(text)[:26])
        y -= row_height

    c.save()
    return str(out_path)


def generate_report_pdfs(report_payload: dict) -> List[str]:
    report_date = str(report_payload.get("reportDate", ""))
    columns1, matrix1 = _build_report1_matrix(report_payload)
    report1 = _render_table_pdf(
        "PMR FARMS DAILY REPORT",
        f"Date: {report_date}",
        columns1,
        matrix1,
    )

    columns2, matrix2 = _build_report2_matrix(report_payload)
    report2 = _render_table_pdf(
        "PMR FARMS DAILY FEED REPORT",
        f"Date: {report_date}",
        columns2,
        matrix2,
    )
    return [report1, report2]
