from __future__ import annotations

import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class CsvInitializationCliTests(unittest.TestCase):
    def setUp(self) -> None:
        self.project_dir = Path(__file__).resolve().parents[1]
        self.temp_dir = Path(tempfile.mkdtemp(prefix="csv-init-test-"))
        self.db_path = self.temp_dir / "test.sqlite"
        self.csv_paths = self._write_csvs()

    def _write_csvs(self) -> dict[str, str]:
        production_standards = self.temp_dir / "production_standards.csv"
        production_standards.write_text(
            "\n".join(
                [
                    "Week,Production,Feed/bird",
                    "20,15.0,0.089",
                ]
            ),
            encoding="utf-8",
        )
        formulations = self.temp_dir / "formulations.csv"
        formulations.write_text(
            "\n".join(
                [
                    "Item Name,Shed 1,Shed 2",
                    "Test Feed,1000,0",
                    "MEDICINES,,",
                    "999.55,999.55,999.85",
                ]
            ),
            encoding="utf-8",
        )
        buyers = self.temp_dir / "buyers.csv"
        buyers.write_text("name,phone,address\nBuyer A,9999999999,Hyd\n", encoding="utf-8")
        sellers = self.temp_dir / "sellers.csv"
        sellers.write_text("name,phone,address\nSeller A,8888888888,Hyd\n", encoding="utf-8")
        feed_closing = self.temp_dir / "feed_closing.csv"
        feed_closing.write_text("feed_name,closing_kg\nTest Feed,1200\n", encoding="utf-8")
        shed_closing = self.temp_dir / "shed_closing.csv"
        shed_closing.write_text(
            "\n".join(
                [
                    "shed_name,closing_birds,standard_eggs_closing,small_eggs_closing,big_eggs_closing,feed_closing",
                    "Shed 1,42000,100,10,5,3500",
                ]
            ),
            encoding="utf-8",
        )
        return {
            "production_standards": str(production_standards),
            "formulations": str(formulations),
            "buyers": str(buyers),
            "sellers": str(sellers),
            "feed_closing": str(feed_closing),
            "shed_closing": str(shed_closing),
        }

    def _run_cli(
        self,
        dry_run: bool = False,
        skip_seed: bool = False,
        replace_parties: bool = False,
        clear_from_baseline: bool = False,
    ) -> tuple[int, dict]:
        cmd = [
            sys.executable,
            "init_from_csv.py",
            "--production-standards",
            self.csv_paths["production_standards"],
            "--formulations",
            self.csv_paths["formulations"],
            "--buyers",
            self.csv_paths["buyers"],
            "--sellers",
            self.csv_paths["sellers"],
            "--feed-closing",
            self.csv_paths["feed_closing"],
            "--shed-closing",
            self.csv_paths["shed_closing"],
        ]
        if dry_run:
            cmd.append("--dry-run")
        if skip_seed:
            cmd.append("--skip-seed")
        if replace_parties:
            cmd.append("--replace-parties")
        if clear_from_baseline:
            cmd.append("--clear-from-baseline")
        env = os.environ.copy()
        env["DATABASE"] = str(self.db_path)
        completed = subprocess.run(
            cmd,
            cwd=self.project_dir,
            env=env,
            check=False,
            capture_output=True,
            text=True,
        )
        payload = json.loads(completed.stdout or "{}")
        return completed.returncode, payload

    def test_end_to_end_import_and_idempotency(self) -> None:
        first_code, first_payload = self._run_cli(dry_run=False)
        self.assertEqual(first_code, 0)
        self.assertGreaterEqual(first_payload["feedItems"]["inserted"], 1)
        self.assertGreaterEqual(first_payload["productionStandards"]["inserted"], 1)
        self.assertGreaterEqual(first_payload["feedFormulations"]["inserted"], 1)

        second_code, second_payload = self._run_cli(dry_run=False)
        self.assertEqual(second_code, 0)
        self.assertEqual(second_payload["feedItems"]["inserted"], 0)
        self.assertEqual(second_payload["productionStandards"]["inserted"], 0)

    def test_dry_run_returns_success_without_errors(self) -> None:
        code, payload = self._run_cli(dry_run=True)
        self.assertEqual(code, 0)
        self.assertFalse(payload["feedItems"]["errors"])
        self.assertFalse(payload["productionStandards"]["errors"])

    def test_new_feed_item_from_closing_is_used_in_formulation(self) -> None:
        code, payload = self._run_cli(dry_run=False)
        self.assertEqual(code, 0)
        self.assertEqual(payload["feedItems"]["errors"], [])
        self.assertEqual(payload["feedFormulations"]["errors"], [])
        self.assertGreaterEqual(payload["feedItems"]["inserted"], 1)
        self.assertGreaterEqual(payload["feedFormulations"]["inserted"], 1)

    def test_skip_seed_imports_only_csv_data(self) -> None:
        # First run seeds schema defaults.
        code, _ = self._run_cli(dry_run=False, skip_seed=False)
        self.assertEqual(code, 0)

        # Clear target data while keeping base refs like users/sheds for csv-only mode.
        conn = sqlite3.connect(self.db_path)
        conn.executescript(
            """
            PRAGMA foreign_keys = OFF;
            DELETE FROM sale_items;
            DELETE FROM sales;
            DELETE FROM feed_receipts;
            DELETE FROM shed_daily_reports;
            DELETE FROM daily_reports;
            DELETE FROM feed_item_daily_stock;
            DELETE FROM feed_formulations;
            DELETE FROM parties;
            DELETE FROM feed_items;
            DELETE FROM production_standards;
            PRAGMA foreign_keys = ON;
            """
        )
        conn.commit()
        conn.close()

        code, payload = self._run_cli(dry_run=False, skip_seed=True)
        self.assertEqual(code, 0)
        self.assertEqual(payload["buyers"]["inserted"], 1)
        self.assertEqual(payload["sellers"]["inserted"], 1)
        self.assertEqual(payload["feedItems"]["inserted"], 1)

        # Ensure seeded defaults were not reintroduced.
        conn = sqlite3.connect(self.db_path)
        row = conn.execute(
            "SELECT COUNT(*) FROM feed_items WHERE name = 'Maize'"
        ).fetchone()
        conn.close()
        self.assertEqual(int(row[0]), 0)

    def test_replace_parties_removes_seeded_parties(self) -> None:
        code, _ = self._run_cli(dry_run=False, skip_seed=False)
        self.assertEqual(code, 0)

        code, payload = self._run_cli(dry_run=False, skip_seed=False, replace_parties=True)
        self.assertEqual(code, 0)
        self.assertEqual(payload["buyers"]["errors"], [])
        self.assertEqual(payload["sellers"]["errors"], [])

        conn = sqlite3.connect(self.db_path)
        count_seeded = conn.execute(
            "SELECT COUNT(*) FROM parties WHERE name = 'Prime Feed Suppliers'"
        ).fetchone()[0]
        count_buyer_csv = conn.execute(
            "SELECT COUNT(*) FROM parties WHERE name = 'Buyer A'"
        ).fetchone()[0]
        conn.close()
        self.assertEqual(int(count_seeded), 0)
        self.assertEqual(int(count_buyer_csv), 1)

    def test_clear_from_baseline_recreates_clean_baseline(self) -> None:
        code, first_payload = self._run_cli(dry_run=False, skip_seed=False)
        self.assertEqual(code, 0)
        baseline_date = int(first_payload["baselineDate"])

        # Create future report data to simulate user test entries.
        conn = sqlite3.connect(self.db_path)
        conn.executescript(
            f"""
            INSERT INTO daily_reports (reportDate, createdByUserId, status, submittedAt, createdAt, updatedAt)
            VALUES ({baseline_date + 1}, 1, 'SUBMITTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
            INSERT INTO feed_item_daily_stock (reportDate, feedItemId, openingKg, receiptsKg, usedKg, closingKg, createdAt, updatedAt)
            VALUES ({baseline_date + 1}, 1, 1, 1, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
            """
        )
        conn.commit()
        conn.close()

        code, second_payload = self._run_cli(
            dry_run=False,
            skip_seed=True,
            replace_parties=True,
            clear_from_baseline=True,
        )
        self.assertEqual(code, 0)
        second_baseline = int(second_payload["baselineDate"])

        conn = sqlite3.connect(self.db_path)
        future_count = conn.execute(
            "SELECT COUNT(*) FROM daily_reports WHERE reportDate > ?",
            (second_baseline,),
        ).fetchone()[0]
        baseline_count = conn.execute(
            "SELECT COUNT(*) FROM daily_reports WHERE reportDate = ?",
            (second_baseline,),
        ).fetchone()[0]
        stale_count = conn.execute(
            "SELECT COUNT(*) FROM daily_reports WHERE reportDate = ?",
            (baseline_date + 1,),
        ).fetchone()[0]
        conn.close()
        self.assertEqual(int(future_count), 0)
        self.assertEqual(int(baseline_count), 1)
        self.assertEqual(int(stale_count), 0)


if __name__ == "__main__":
    unittest.main()
