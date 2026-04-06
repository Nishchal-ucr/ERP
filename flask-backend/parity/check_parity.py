#!/usr/bin/env python3
import json
import sys
from typing import Any

import requests


NEST_BASE = "http://localhost:8000"
FLASK_BASE = "http://localhost:8001"


def _fetch(method: str, base: str, path: str, body: dict | None = None):
    url = f"{base}{path}"
    response = requests.request(method, url, json=body, timeout=10)
    payload: Any
    try:
        payload = response.json()
    except Exception:
        payload = response.text
    return response.status_code, payload


def _signature(value: Any):
    if isinstance(value, dict):
        return {k: _signature(v) for k, v in sorted(value.items())}
    if isinstance(value, list):
        if not value:
            return []
        return [_signature(value[0])]
    return type(value).__name__


def _compare_case(name: str, method: str, path: str, body: dict | None = None):
    nest_status, nest_payload = _fetch(method, NEST_BASE, path, body)
    flask_status, flask_payload = _fetch(method, FLASK_BASE, path, body)

    status_ok = nest_status == flask_status
    shape_ok = _signature(nest_payload) == _signature(flask_payload)

    print(f"\n[{name}] {method} {path}")
    print(f"  Nest : {nest_status}")
    print(f"  Flask: {flask_status}")
    print(f"  status_match={status_ok} shape_match={shape_ok}")

    if not status_ok or not shape_ok:
        print("  --- nest payload ---")
        print(json.dumps(nest_payload, indent=2, default=str))
        print("  --- flask payload ---")
        print(json.dumps(flask_payload, indent=2, default=str))

    return status_ok and shape_ok


def main() -> int:
    login_body = {"phone": "9876543210", "password": "22446688"}

    all_ok = True
    all_ok &= _compare_case("root", "GET", "/")
    all_ok &= _compare_case("login", "POST", "/api/user/login", login_body)
    all_ok &= _compare_case("sheds_all", "GET", "/api/sheds")
    all_ok &= _compare_case("parties_all", "GET", "/api/parties")
    all_ok &= _compare_case("feed_items_all", "GET", "/api/feed-items")
    all_ok &= _compare_case("daily_reports_by_date_404", "GET", "/api/daily-reports/by-date/2026-04-06")

    print("\nResult:", "PASS" if all_ok else "FAIL")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
