import logging

from flask import Blueprint, request

from config import Config
from services.flock_placement_service import ShedNotFoundError
from services.csv_master_append import (
    append_feed_closing_row,
    append_feed_formulation_zeros_row,
    append_seller_party_row,
)
from services.feed_item_daily_stock_service import (
    get_latest_feed_item_daily_stock_snapshot,
    patch_feed_item_daily_stock,
)
from services.lookup_service import (
    create_feed_formulation,
    create_feed_item,
    create_party,
    delete_feed_formulation,
    delete_feed_item,
    get_all,
    get_by_id,
    get_feed_formulation_by_id,
    get_feed_formulations,
    get_flock_summary,
    list_parties,
    party_type_from_role,
    update_feed_formulation,
    update_party_active,
    update_shed_flock_number,
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


@lookup_bp.patch("/api/sheds/<raw_id>/flock-id")
def sheds_patch_flock_id(raw_id: str):
    item_id, err = _parse_int_or_400(raw_id)
    if err:
        return err
    payload = request.get_json(silent=True) or {}
    fn = payload.get("flockNumber")
    if fn is not None and not isinstance(fn, str):
        return error("flockNumber must be a string", 400)
    try:
        result = update_shed_flock_number(
            item_id,
            str(fn) if fn is not None else "",
        )
    except ShedNotFoundError:
        return error("Shed not found or inactive.", 404)
    except ValueError as exc:
        return error(str(exc), 400)
    except Exception:
        logger.exception("patch flock-id failed")
        return error("Failed to update flock ID.", 500)
    return ok(result, 200)


@lookup_bp.get("/api/flock-summary")
def flock_summary():
    return ok(get_flock_summary())


@lookup_bp.get("/api/parties")
def parties_all():
    active_param = request.args.get("active")
    kind_raw = (request.args.get("kind") or "").strip().lower()
    role_raw = (request.args.get("role") or "").strip().lower()

    active = None
    if active_param is not None and str(active_param).strip() != "":
        al = str(active_param).strip().lower()
        if al in ("true", "1", "yes"):
            active = True
        elif al in ("false", "0", "no"):
            active = False
        else:
            return error("active must be true or false", 400)

    kind = None
    if kind_raw in ("buyer", "seller", "both"):
        kind = kind_raw
    elif role_raw in ("buyer", "seller"):
        kind = role_raw
    elif kind_raw:
        return error("kind must be buyer, seller, or both", 400)
    elif role_raw:
        return error("role must be either 'buyer' or 'seller'", 400)

    try:
        return ok(list_parties(active=active, kind=kind))
    except ValueError as exc:
        return error(str(exc), 400)


@lookup_bp.get("/api/parties/<raw_id>")
def parties_one(raw_id: str):
    item_id, err = _parse_int_or_400(raw_id)
    if err:
        return err
    return ok(get_by_id("parties", item_id))


@lookup_bp.patch("/api/parties/<raw_id>")
def parties_patch(raw_id: str):
    item_id, err = _parse_int_or_400(raw_id)
    if err:
        return err
    payload = request.get_json(silent=True) or {}
    if "active" not in payload:
        return error("active is required", 400)
    active = payload["active"]
    if not isinstance(active, bool):
        return error("active must be a boolean", 400)
    party = update_party_active(item_id, active)
    if party is None:
        return error("Party not found", 404)
    return ok(party, 200)


@lookup_bp.post("/api/parties")
def parties_create():
    payload = request.get_json(silent=True) or {}
    name = payload.get("name")
    role = payload.get("role")
    phone = payload.get("phone")
    address = payload.get("address")
    email = payload.get("email")
    if phone is not None and not isinstance(phone, str):
        return error("phone must be a string", 400)
    if address is not None and not isinstance(address, str):
        return error("address must be a string", 400)
    if email is not None and not isinstance(email, str):
        return error("email must be a string", 400)
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
            email if isinstance(email, str) else None,
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


@lookup_bp.delete("/api/feed-items/<raw_id>")
def feed_items_delete(raw_id: str):
    item_id, err = _parse_int_or_400(raw_id)
    if err:
        return err
    try:
        delete_feed_item(item_id)
    except ValueError as exc:
        msg = str(exc)
        if msg.startswith("Feed item not found"):
            return error(msg, 404)
        return error(msg, 400)
    except Exception:
        logger.exception("delete feed item failed")
        return error("Failed to delete feed item.", 500)
    return ok({"deleted": True, "id": item_id}, 200)


@lookup_bp.get("/api/feed-formulations")
def feed_formulations_all():
    return ok(get_feed_formulations())


@lookup_bp.get("/api/feed-formulations/<raw_id>")
def feed_formulations_one(raw_id: str):
    item_id, err = _parse_int_or_400(raw_id)
    if err:
        return err
    return ok(get_feed_formulation_by_id(item_id))


def _feed_formulation_error(exc: ValueError):
    msg = str(exc)
    if "not found" in msg.lower():
        return error(msg, 404)
    return error(msg, 400)


@lookup_bp.patch("/api/feed-formulations/<raw_id>")
def feed_formulations_patch(raw_id: str):
    item_id, err = _parse_int_or_400(raw_id)
    if err:
        return err
    payload = request.get_json(silent=True) or {}
    ratio_raw = payload.get("ratioPer1000Kg")
    if ratio_raw is None:
        return error("ratioPer1000Kg is required", 400)
    try:
        ratio = float(ratio_raw)
    except (TypeError, ValueError):
        return error("ratioPer1000Kg must be a number", 400)
    try:
        result = update_feed_formulation(item_id, ratio)
    except ValueError as exc:
        return _feed_formulation_error(exc)
    except Exception:
        logger.exception("patch feed formulation failed")
        return error("Failed to update feed formulation.", 500)
    return ok(result, 200)


@lookup_bp.post("/api/feed-formulations")
def feed_formulations_create():
    payload = request.get_json(silent=True) or {}
    shed_raw = payload.get("shedId")
    feed_raw = payload.get("feedItemId")
    ratio_raw = payload.get("ratioPer1000Kg")
    if shed_raw is None:
        return error("shedId is required", 400)
    if feed_raw is None:
        return error("feedItemId is required", 400)
    if ratio_raw is None:
        return error("ratioPer1000Kg is required", 400)
    try:
        shed_id = int(shed_raw)
        feed_item_id = int(feed_raw)
        ratio = float(ratio_raw)
    except (TypeError, ValueError):
        return error("shedId and feedItemId must be integers; ratioPer1000Kg a number", 400)
    try:
        result = create_feed_formulation(shed_id, feed_item_id, ratio)
    except ValueError as exc:
        return _feed_formulation_error(exc)
    except Exception:
        logger.exception("create feed formulation failed")
        return error("Failed to create feed formulation.", 500)
    return ok(result, 201)


@lookup_bp.delete("/api/feed-formulations/<raw_id>")
def feed_formulations_delete(raw_id: str):
    item_id, err = _parse_int_or_400(raw_id)
    if err:
        return err
    try:
        delete_feed_formulation(item_id)
    except ValueError as exc:
        return _feed_formulation_error(exc)
    except Exception:
        logger.exception("delete feed formulation failed")
        return error("Failed to delete feed formulation.", 500)
    return ok({"deleted": True, "id": item_id}, 200)


@lookup_bp.get("/api/feed-item-daily-stock/latest")
def feed_item_daily_stock_latest():
    return ok(get_latest_feed_item_daily_stock_snapshot())


@lookup_bp.patch("/api/feed-item-daily-stock")
def feed_item_daily_stock_patch():
    payload = request.get_json(silent=True) or {}
    rd = payload.get("reportDate")
    if rd is None:
        return error("reportDate is required", 400)
    try:
        report_date = int(rd)
    except (TypeError, ValueError):
        return error("reportDate must be an integer YYYYMMDD", 400)
    items = payload.get("items")
    if not isinstance(items, list) or not items:
        return error("items must be a non-empty array", 400)
    try:
        result = patch_feed_item_daily_stock(report_date, items)
    except ValueError as exc:
        return error(str(exc), 400)
    return ok(result)
