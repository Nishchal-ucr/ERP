from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from config import Config
from db.connection import get_connection


def login(phone: str, password: str):
    with get_connection() as conn:
        user = conn.execute(
            "SELECT id, name, phone, passwordHash, role, createdAt FROM users WHERE phone = %s",
            (phone,),
        ).fetchone()

    if not user:
        return None

    is_valid = bcrypt.checkpw(
        password.encode("utf-8"),
        user["passwordHash"].encode("utf-8"),
    )
    if not is_valid:
        return None

    now = datetime.now(timezone.utc)
    payload = {
        "sub": user["id"],
        "phone": user["phone"],
        "role": user["role"],
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=Config.JWT_EXP_HOURS)).timestamp()),
    }
    token = jwt.encode(payload, Config.JWT_SECRET, algorithm="HS256")

    return {
        "message": "Login successful",
        "user": {
            "id": str(user["id"]),
            "phone": user["phone"],
            "name": user["name"],
            "role": user["role"],
            "createdAt": user["createdAt"],
        },
        "token": token,
    }
