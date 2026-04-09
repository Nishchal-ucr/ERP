from __future__ import annotations

import os
import sys
import types
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from config import Config
from db.connection import get_connection
from db.schema import initialize_schema
from db.seed import seed_data

# Provide lightweight stubs so reporting_service import succeeds in test envs
# without optional PDF dependencies installed.
if "reportlab" not in sys.modules:
    reportlab = types.ModuleType("reportlab")
    reportlab_lib = types.ModuleType("reportlab.lib")
    reportlab_colors = types.SimpleNamespace(lightgrey=None, black=None)
    reportlab_pagesizes = types.ModuleType("reportlab.lib.pagesizes")
    reportlab_pagesizes.A4 = (0, 0)
    reportlab_pagesizes.landscape = lambda x: x
    reportlab_pdfgen = types.ModuleType("reportlab.pdfgen")
    reportlab_canvas = types.ModuleType("reportlab.pdfgen.canvas")

    class _DummyCanvas:
        def __init__(self, *args, **kwargs):
            pass

    reportlab_canvas.Canvas = _DummyCanvas
    reportlab_lib.colors = reportlab_colors
    sys.modules["reportlab"] = reportlab
    sys.modules["reportlab.lib"] = reportlab_lib
    sys.modules["reportlab.lib.colors"] = reportlab_colors
    sys.modules["reportlab.lib.pagesizes"] = reportlab_pagesizes
    sys.modules["reportlab.pdfgen"] = reportlab_pdfgen
    sys.modules["reportlab.pdfgen.canvas"] = reportlab_canvas

from services.daily_reports_service import submit_daily_report
from services.lookup_service import get_parties_by_role


class PartyRoleBehaviorTests(unittest.TestCase):
    def setUp(self) -> None:
        db_url = os.environ.get("TEST_DATABASE_URL", os.environ.get("DATABASE_URL", ""))
        if not db_url:
            self.skipTest("TEST_DATABASE_URL or DATABASE_URL must be set to run tests.")
        Config.DATABASE_URL = db_url
        initialize_schema()
        seed_data()

    def test_lookup_role_filters(self) -> None:
        buyers = get_parties_by_role("buyer")
        sellers = get_parties_by_role("seller")
        self.assertTrue(all(item["type"] in {"CUSTOMER", "BOTH"} for item in buyers))
        self.assertTrue(all(item["type"] in {"SUPPLIER", "BOTH"} for item in sellers))

    def test_submit_rejects_supplier_party_for_sales(self) -> None:
        with get_connection() as conn:
            supplier = conn.execute(
                "SELECT id FROM parties WHERE type = 'SUPPLIER' ORDER BY id LIMIT 1"
            ).fetchone()
        payload = {
            "reportDate": "2026-04-09",
            "submitterId": 1,
            "sales": [
                {
                    "partyId": int(supplier["id"]),
                    "vehicleNumber": "AP09XX11",
                    "items": [],
                }
            ],
            "feedReceipts": [],
            "shedDailyReports": [],
        }
        with self.assertRaises(ValueError):
            submit_daily_report(payload)

    def test_submit_rejects_customer_party_for_feed_receipt(self) -> None:
        with get_connection() as conn:
            cur = conn.execute(
                "INSERT INTO parties (name, type, phone, address) VALUES (%s, 'CUSTOMER', %s, %s) RETURNING id",
                ("Only Customer", "9999999999", "Hyd"),
            )
            customer_id = int(cur.fetchone()["id"])
            conn.commit()
        payload = {
            "reportDate": "2026-04-10",
            "submitterId": 1,
            "sales": [],
            "feedReceipts": [
                {
                    "partyId": customer_id,
                    "feedItemId": 1,
                    "vehicleNumber": "AP09YY22",
                    "quantityKg": 100.0,
                }
            ],
            "shedDailyReports": [],
        }
        with self.assertRaises(ValueError):
            submit_daily_report(payload)


if __name__ == "__main__":
    unittest.main()
