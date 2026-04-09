#!/usr/bin/env python3
from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
import sys

from db.connection import get_connection
from db.schema import initialize_schema


def _parse_ddmmyyyy(raw_date: str) -> str:
    try:
        dt = datetime.strptime(raw_date, "%d/%m/%Y")
    except ValueError as exc:
        raise ValueError("date must be in DD/MM/YYYY format") from exc
    return dt.strftime("%Y-%m-%d")


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate and email PMR reports for a specific date."
    )
    parser.add_argument(
        "--date",
        required=True,
        help="Report date in DD/MM/YYYY format (example: 08/04/2026).",
    )
    return parser


def main() -> int:
    args = _build_parser().parse_args()

    try:
        iso_date = _parse_ddmmyyyy(args.date)
    except ValueError as exc:
        print(f"Validation failed: {exc}", file=sys.stderr)
        return 1

    pdf_paths: list[str] = []
    try:
        initialize_schema()
        report_int = int(iso_date.replace("-", ""))
        with get_connection() as conn:
            row = conn.execute(
                "SELECT id FROM daily_reports WHERE reportDate = %s",
                (report_int,),
            ).fetchone()
        if not row:
            print(f"No report found for date {args.date}.", file=sys.stderr)
            return 1

        from services.daily_reports_service import get_daily_report_with_details
        from services.email_service import send_reports_email
        from services.reporting_service import generate_report_pdfs

        payload = get_daily_report_with_details(int(row["id"]))
        if not payload:
            print(f"Could not load report details for {args.date}.", file=sys.stderr)
            return 1
        pdf_paths = generate_report_pdfs(payload)
        warning = send_reports_email(iso_date, pdf_paths)
        if warning:
            print(f"Mail send warning: {warning}", file=sys.stderr)
            return 1
        print(f"Report email sent successfully for {args.date}.")
        return 0
    except ModuleNotFoundError as exc:
        print(
            f"Missing dependency: {exc}. Install required packages before sending reports.",
            file=sys.stderr,
        )
        return 1
    except Exception as exc:  # pragma: no cover
        print(f"Unexpected failure: {exc}", file=sys.stderr)
        return 2
    finally:
        for p in pdf_paths:
            try:
                Path(p).unlink(missing_ok=True)
            except Exception:
                pass


if __name__ == "__main__":
    raise SystemExit(main())
