"""Append rows to master CSV files (atomic replace). Used when creating parties / feed items via API."""

from __future__ import annotations

import csv
import logging
import os
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)


def _norm(value: str | None) -> str:
    return (value or "").strip()


def _norm_key(value: str | None) -> str:
    return _norm(value).lower().replace(" ", "").replace("_", "").replace("-", "")


def _atomic_write_csv(path: Path, lines: list[list[str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(
        suffix=".csv",
        dir=str(path.parent),
        text=True,
    )
    try:
        with os.fdopen(fd, "w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            for row in lines:
                writer.writerow(row)
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def append_seller_party_row(path: str, name: str) -> bool:
    """Append name,phone,address as name,-,- if not already present (case-insensitive name)."""
    name_clean = _norm(name)
    if not name_clean:
        return False
    csv_path = Path(path)
    rows: list[list[str]] = []
    if csv_path.exists():
        with csv_path.open("r", newline="", encoding="utf-8-sig") as handle:
            reader = csv.reader(handle)
            for row in reader:
                rows.append(row)
    if not rows:
        rows = [["name", "phone", "address"]]
    header = rows[0]
    name_col = next(
        (i for i, h in enumerate(header) if _norm_key(h) in {"name", "partyname", "party"}),
        0,
    )
    phone_col = next(
        (i for i, h in enumerate(header) if _norm_key(h) in {"phone", "contact", "mobile"}),
        1 if len(header) > 1 else 0,
    )
    addr_col = next(
        (i for i, h in enumerate(header) if _norm_key(h) in {"address", "location"}),
        2 if len(header) > 2 else min(1, len(header) - 1),
    )
    for row in rows[1:]:
        if len(row) > name_col and _norm_key(row[name_col]) == _norm_key(name_clean):
            return False
    data_row = [""] * len(header)
    data_row[name_col] = name_clean
    if phone_col < len(data_row):
        data_row[phone_col] = "-"
    if addr_col < len(data_row):
        data_row[addr_col] = "-"
    rows.append(data_row)
    try:
        _atomic_write_csv(csv_path, rows)
    except OSError as exc:
        logger.warning("Could not write seller parties CSV %s: %s", path, exc)
        return False
    return True


def append_feed_closing_row(path: str, feed_name: str, closing_kg: float) -> bool:
    """Append feed_name, closing_kg if feed_name not already present."""
    name_clean = _norm(feed_name)
    if not name_clean:
        return False
    csv_path = Path(path)
    rows: list[list[str]] = []
    if csv_path.exists():
        with csv_path.open("r", newline="", encoding="utf-8-sig") as handle:
            reader = csv.reader(handle)
            for row in reader:
                rows.append(row)
    if not rows:
        rows = [["feed_name", "closing_kg"]]
    header = rows[0]
    name_col = next(
        (i for i, h in enumerate(header) if _norm_key(h) in {"feedname", "feeditem", "name", "feed"}),
        0,
    )
    for row in rows[1:]:
        if len(row) > name_col and _norm_key(row[name_col]) == _norm_key(name_clean):
            return False
    qty_col = next(
        (i for i, h in enumerate(header) if _norm_key(h) in {"closingkg", "closing", "qtykg", "quantitykg"}),
        1 if len(header) > 1 else 0,
    )
    data_row = [""] * len(header)
    data_row[name_col] = name_clean
    if qty_col < len(data_row):
        data_row[qty_col] = str(closing_kg)
    rows.append(data_row)
    try:
        _atomic_write_csv(csv_path, rows)
    except OSError as exc:
        logger.warning("Could not write feed closing CSV %s: %s", path, exc)
        return False
    return True


def append_feed_formulation_zeros_row(path: str, item_name: str) -> bool:
    """Append one row: item name in item column, 0 for every shed column."""
    name_clean = _norm(item_name)
    if not name_clean:
        return False
    csv_path = Path(path)
    if not csv_path.exists():
        logger.warning("Feed formulations CSV not found: %s", path)
        return False
    with csv_path.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.reader(handle)
        rows = list(reader)
    if not rows:
        return False
    header = rows[0]
    item_col = -1
    for i, h in enumerate(header):
        if _norm_key(h) in {"itemname", "feedname", "feeditem", "item"}:
            item_col = i
            break
    if item_col < 0:
        item_col = 0
    shed_indices = [i for i in range(len(header)) if i != item_col and _norm(header[i])]
    for row in rows[1:]:
        if len(row) > item_col and _norm_key(row[item_col]) == _norm_key(name_clean):
            return False
    new_row = [""] * len(header)
    new_row[item_col] = name_clean
    for i in shed_indices:
        new_row[i] = "0"
    rows.append(new_row)
    try:
        _atomic_write_csv(csv_path, rows)
    except OSError as exc:
        logger.warning("Could not write feed formulations CSV %s: %s", path, exc)
        return False
    return True
