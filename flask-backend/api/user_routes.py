from flask import Blueprint, request

from services.auth_service import login
from utils.http import error, ok

user_bp = Blueprint("user", __name__)


@user_bp.post("/api/user/login")
def user_login():
    body = request.get_json(silent=True) or {}
    phone = body.get("phone")
    password = body.get("password")

    if not isinstance(phone, str) or not phone.strip():
        return error("phone must be a non-empty string", 400)
    if not isinstance(password, str) or len(password) < 6 or len(password) > 255:
        return error("password length must be between 6 and 255", 400)

    result = login(phone=phone, password=password)
    if not result:
        return error("Invalid phone or password", 401)
    return ok(result, 201)
