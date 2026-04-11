from flask import Blueprint, request

from services.daily_reports_service import (
    get_daily_report_by_date,
    get_daily_report_with_details,
    list_daily_reports,
    submit_daily_report,
    update_daily_report,
)
from services.shed_closing_override_service import apply_shed_closing_override
from utils.http import error, ok

daily_reports_bp = Blueprint("daily_reports", __name__)


def _validate_submit_payload(payload):
    if not isinstance(payload, dict):
        return "body must be a JSON object"

    if not isinstance(payload.get("reportDate"), str):
        return "reportDate must be an ISO-8601 date string"
    if not isinstance(payload.get("submitterId"), (int, float)):
        return "submitterId must be a number"

    for key in ("sales", "feedReceipts", "shedDailyReports"):
        value = payload.get(key)
        if value is not None and not isinstance(value, list):
            return f"{key} must be an array"
    return None


def _validate_shed_closing_override_payload(payload):
    if not isinstance(payload, dict):
        return "body must be a JSON object"
    if not isinstance(payload.get("reportDate"), str):
        return "reportDate must be an ISO-8601 date string"
    for key in ("shedId", "submitterId"):
        if not isinstance(payload.get(key), (int, float)):
            return f"{key} must be a number"
    for key in (
        "closingBirds",
        "standardEggsClosing",
        "smallEggsClosing",
        "bigEggsClosing",
        "feedClosing",
    ):
        if payload.get(key) is None:
            return f"{key} is required"
        if not isinstance(payload[key], (int, float)):
            return f"{key} must be a number"
    return None


@daily_reports_bp.post("/api/shed-closing-override")
def shed_closing_override():
    payload = request.get_json(silent=True) or {}
    validation_error = _validate_shed_closing_override_payload(payload)
    if validation_error:
        return error(validation_error, 400)

    try:
        result, reason = apply_shed_closing_override(payload)
    except ValueError as exc:
        return error(str(exc), 400)
    except Exception as exc:
        return error(f"Failed to apply shed closing override: {exc}", 500)

    if reason == "not_found":
        return error("No daily report for this date.", 404)
    if reason == "no_shed_line":
        return error(
            "No shed data for this date; complete shed entry for this day first.",
            400,
        )
    return ok(result, 200)


@daily_reports_bp.post("/api/daily-reports/submit")
def submit():
    payload = request.get_json(silent=True) or {}
    validation_error = _validate_submit_payload(payload)
    if validation_error:
        return error(validation_error, 400)

    try:
        result = submit_daily_report(payload)
        return ok(result, 201)
    except ValueError as exc:
        return error(str(exc), 400)
    except Exception as exc:
        return error(f"Failed to submit daily report: {exc}", 500)


@daily_reports_bp.put("/api/daily-reports/update")
def update():
    payload = request.get_json(silent=True) or {}
    validation_error = _validate_submit_payload(payload)
    if validation_error:
        return error(validation_error, 400)

    try:
        result, reason = update_daily_report(payload)
    except ValueError as exc:
        return error(str(exc), 400)
    except Exception as exc:
        return error(f"Failed to update daily report: {exc}", 500)

    if reason == "not_found":
        return error(f"Cannot update: no report exists for {payload.get('reportDate')}.", 404)
    if reason == "locked":
        return error(
            "Cannot update: A report for this date has already been submitted and locked.",
            400,
        )
    return ok(result, 200)


@daily_reports_bp.get("/api/daily-reports")
def all_daily_reports():
    return ok(list_daily_reports())


@daily_reports_bp.get("/api/daily-reports/<raw_id>")
def daily_report_by_id(raw_id: str):
    try:
        report_id = int(raw_id)
    except ValueError:
        return error("Validation failed (numeric string is expected)", 400)

    report = get_daily_report_with_details(report_id)
    if not report:
        return error(f"Daily report with ID {report_id} not found.", 404)
    return ok(report)


@daily_reports_bp.get("/api/daily-reports/by-date/<date_string>")
def daily_report_by_date(date_string: str):
    try:
        report = get_daily_report_by_date(date_string)
    except ValueError as exc:
        return error(str(exc), 400)
    if not report:
        return error(f"Daily report for date {date_string} not found.", 404)
    return ok(report)
