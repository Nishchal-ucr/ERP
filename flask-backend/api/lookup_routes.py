from flask import Blueprint

from services.lookup_service import get_all, get_by_id
from utils.http import error, ok

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


@lookup_bp.get("/api/parties")
def parties_all():
    return ok(get_all("parties"))


@lookup_bp.get("/api/parties/<raw_id>")
def parties_one(raw_id: str):
    item_id, err = _parse_int_or_400(raw_id)
    if err:
        return err
    return ok(get_by_id("parties", item_id))


@lookup_bp.get("/api/feed-items")
def feed_items_all():
    return ok(get_all("feed_items"))


@lookup_bp.get("/api/feed-items/<raw_id>")
def feed_items_one(raw_id: str):
    item_id, err = _parse_int_or_400(raw_id)
    if err:
        return err
    return ok(get_by_id("feed_items", item_id))
