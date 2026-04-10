#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys

from db.schema import initialize_schema
from db.seed import seed_data
from services.csv_initialization_service import run_csv_initialization


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Initialize ERP masters and baselines from CSV files."
    )
    parser.add_argument(
        "--production-standards",
        "--feed-standards",
        dest="production_standards",
        required=True,
        help="Production standards CSV path",
    )
    parser.add_argument("--formulations", required=True, help="Feed formulations CSV path")
    parser.add_argument("--buyers", required=True, help="Buyer parties CSV path")
    parser.add_argument("--sellers", required=True, help="Seller parties CSV path")
    parser.add_argument("--feed-closing", required=True, help="Feed closing stock CSV path")
    parser.add_argument("--shed-closing", required=True, help="Shed closing values CSV path")
    parser.add_argument(
        "--skip-seed",
        action="store_true",
        help="Skip default seed data and import from CSVs only.",
    )
    parser.add_argument(
        "--replace-parties",
        action="store_true",
        help="Delete existing parties before importing buyer/seller CSVs.",
    )
    parser.add_argument(
        "--clear-from-baseline",
        action="store_true",
        help="Delete reports and stock from baseline date onward before importing baseline.",
    )
    parser.add_argument(
        "--prune-orphan-feed-items",
        action="store_true",
        help=(
            "Remove feed_items rows not listed in --feed-closing or --formulations CSVs. "
            "Skips rows still referenced by feed_receipts. Use after --clear-from-baseline "
            "if receipts were cleared, to align the DB with CSV masters."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and simulate import without writing to DB.",
    )
    return parser


def main() -> int:
    args = _build_parser().parse_args()
    try:
        initialize_schema()
        if not args.skip_seed:
            seed_data()
        result = run_csv_initialization(
            production_standards_csv=args.production_standards,
            formulations_csv=args.formulations,
            buyers_csv=args.buyers,
            sellers_csv=args.sellers,
            feed_closing_csv=args.feed_closing,
            shed_closing_csv=args.shed_closing,
            replace_parties=args.replace_parties,
            clear_from_baseline=args.clear_from_baseline,
            prune_orphan_feed_items=args.prune_orphan_feed_items,
            dry_run=args.dry_run,
        )
        print(json.dumps(result, indent=2))
        any_errors = any(
            bool((section or {}).get("errors"))
            for key, section in result.items()
            if key not in {"baselineDate", "baselineDailyReportId"}
        )
        return 1 if any_errors else 0
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, indent=2), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
