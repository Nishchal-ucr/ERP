import logging

from flask import Blueprint, request

from services.cull_bird_sales_service import cull_bird_sales
from services.flock_placement_service import ShedNotFoundError, place_new_batch
from services.shed_transfer_service import transfer_shed
from utils.http import error, ok

logger = logging.getLogger(__name__)

flock_bp = Blueprint("flock", __name__)


@flock_bp.post("/api/flock-placement")
def flock_placement():
    payload = request.get_json(silent=True) or {}
    try:
        result = place_new_batch(payload)
    except ShedNotFoundError:
        return error("Shed not found or inactive.", 404)
    except ValueError as exc:
        return error(str(exc), 400)
    except Exception:
        logger.exception("flock-placement failed")
        return error("Failed to place flock.", 500)
    return ok(result, 200)


@flock_bp.post("/api/shed-transfer")
def shed_transfer():
    payload = request.get_json(silent=True) or {}
    try:
        result = transfer_shed(payload)
    except ShedNotFoundError:
        return error("Shed not found or inactive.", 404)
    except ValueError as exc:
        return error(str(exc), 400)
    except Exception:
        logger.exception("shed-transfer failed")
        return error("Failed to transfer birds.", 500)
    return ok(result, 200)


@flock_bp.post("/api/cull-bird-sales")
def cull_bird_sales_route():
    payload = request.get_json(silent=True) or {}
    try:
        result = cull_bird_sales(payload)
    except ShedNotFoundError:
        return error("Shed not found or inactive.", 404)
    except ValueError as exc:
        return error(str(exc), 400)
    except Exception:
        logger.exception("cull-bird-sales failed")
        return error("Failed to record cull bird sales.", 500)
    return ok(result, 200)
