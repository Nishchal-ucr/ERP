import logging

from flask import Blueprint, request

from config import Config
from services.csv_master_append import (
    append_feed_closing_row,
    append_feed_formulation_zeros_row,
    append_seller_party_row,
)
from services.lookup_service import (
    create_feed_item,
    create_party,
    get_all,
    get_by_id,
    get_feed_formulation_by_id,
    get_feed_formulations,
    get_flock_summary,
    get_parties_by_role,
    party_type_from_role,
)
from utils.http import error, ok

logger = logging.getLogger(__name__)

lookup_bp = Blueprint("lookup", __name__)


def _parse_int_or_400(raw_id: str):
    try:
        return int(raw_id), None
    except ValueError:
        return None, error("Validation failed (numeric string is expected)", 400)


@lookup_bp.get("/api/sheds")
def sheds_all():
    return ok(get_all("sheds"))


@lookup_bp.get("/api/sheds/<raw_id>")
def sheds_one(raw_id: str):
    item_id, err = _parse_int_or_400(raw_id)
    if err:
        return err
    return ok(get_by_id("sheds", item_id))


@lookup_bp.get("/api/flock-summary")
def flock_summary():
    return ok(get_flock_summary())


@lookup_bp.get("/api/parties")
def parties_all():
    role = (request.args.get("role") or "").strip().lower()
    if not role:
        return ok(get_all("parties"))
    try:
        return ok(get_parties_by_role(role))
    except ValueError as exc:
        return error(str(exc), 400)


@lookup_bp.get("/api/parties/<raw_id>")
def parties_one(raw_id: str):
    item_id, err = _parse_int_or_400(raw_id)
    if err:
        return err
    return ok(get_by_id("parties", item_id))


@lookup_bp.post("/api/parties")
def parties_create():
    payload = request.get_json(silent=True) or {}
    name = payload.get("name")
    role = payload.get("role")
    phone = payload.get("phone")
    address = payload.get("address")
    if phone is not None and not isinstance(phone, str):
        return error("phone must be a string", 400)
    if address is not None and not isinstance(address, str):
        return error("address must be a string", 400)
    try:
        party_type = party_type_from_role(str(role) if role is not None else "")
    except ValueError as exc:
        return error(str(exc), 400)
    try:
        party, created = create_party(
            str(name) if name is not None else "",
            party_type,
            phone if isinstance(phone, str) else None,
            address if isinstance(address, str) else None,
        )
    except ValueError as exc:
        return error(str(exc), 400)
    if party_type == "SUPPLIER" and party:
        try:
            if not append_seller_party_row(Config.CSV_SELLERS_PATH, party["name"]):
                logger.debug(
                    "Seller party CSV unchanged or skipped: %s", party.get("name")
                )
        except OSError as exc:
            logger.warning("Could not append seller parties CSV: %s", exc)
    status = 201 if created else 200
    return ok(party, status)


@lookup_bp.get("/api/feed-items")
def feed_items_all():
    return ok(get_all("feed_items"))


@lookup_bp.get("/api/feed-items/<raw_id>")
def feed_items_one(raw_id: str):
    item_id, err = _parse_int_or_400(raw_id)
    if err:
        return err
    return ok(get_by_id("feed_items", item_id))


@lookup_bp.post("/api/feed-items")
def feed_items_create():
    payload = request.get_json(silent=True) or {}
    name = payload.get("name")
    category = payload.get("category") or "INGREDIENT"
    if not isinstance(category, str):
        return error("category must be a string", 400)
    closing_raw = payload.get("closingKg")
    closing_kg = 0.0
    if closing_raw is not None:
        try:
            closing_kg = float(closing_raw)
        except (TypeError, ValueError):
            return error("closingKg must be a number", 400)
    try:
        item, created = create_feed_item(
            str(name) if name is not None else "",
            category.strip().upper(),
            closing_kg,
        )
    except ValueError as exc:
        return error(str(exc), 400)
    if created and item:
        try:
            append_feed_closing_row(
                Config.CSV_FEED_CLOSING_PATH, item["name"], closing_kg
            )
            append_feed_formulation_zeros_row(
                Config.CSV_FEED_FORMULATIONS_PATH, item["name"]
            )
        except OSError as exc:
            logger.warning("Could not append feed master CSVs: %s", exc)
    status = 201 if created else 200
    return ok(item, status)


@lookup_bp.get("/api/feed-formulations")
def feed_formulations_all():
    return ok(get_feed_formulations())


@lookup_bp.get("/api/feed-formulations/<raw_id>")
def feed_formulations_one(raw_id: str):
    item_id, err = _parse_int_or_400(raw_id)
    if err:
        return err
    return ok(get_feed_formulation_by_id(item_id))
