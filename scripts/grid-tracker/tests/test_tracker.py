"""Offline regression tests for consequential accounting and archival behavior."""
import csv
import io
import json
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import grid_tracker as grid

START = "2026-07-02T00:00:00Z"
END = "2026-07-03T00:00:00Z"


def row(hour=1, demand="110", generation="100", exports="-10", **extra):
    return {"Balancing Authority": "PACE", grid.UTC_COLUMN: f"07/02/2026 {hour}:00:00 AM",
            "Local Time at End of Hour": "ambiguous local hour label",
            "Demand (MW)": demand, "Demand Forecast (MW)": "105",
            "Net Generation (MW)": generation, "Total Interchange (MW)": exports,
            grid.FUEL_PREFIX + "Natural Gas": "120", grid.FUEL_PREFIX + "Battery Storage": "-20",
            grid.FUEL_PREFIX + "Nuclear": "", "Demand (MW) (Adjusted)": demand or "999", **extra}


def csv_bytes(rows, fields=None):
    text = io.StringIO(newline="")
    writer = csv.DictWriter(text, fieldnames=fields or list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
    return text.getvalue().encode()


class TrackerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name)
        self.db = grid.connect(self.path)
        self.fetch = self.source()

    def tearDown(self):
        self.db.close()
        self.temp.cleanup()

    def source(self, kind="BALANCE"):
        return grid.save_fetch(self.db, None, grid.BASE + f"EIA930_{kind}_2026_Jul_Dec.csv",
            {"fetched_at": "2026-09-28T00:00:00Z", "sha256": "fixture", "archive_path": "fixture.csv.gz"}, {})

    def ingest(self, rows, fetch=None, kind="BALANCE"):
        return grid.ingest(self.db, csv_bytes(rows), kind, ["PACE"], START, END, fetch or self.fetch)

    def report(self):
        return grid.report(self.db, "PACE", START, END)

    def test_import_sign_and_negative_storage(self):
        self.ingest([row()])
        event = self.report()["highest_demand_hours"][0]
        self.assertEqual(event["net_imports_mw"], 10)
        self.assertEqual(event["balance_residual_mw"], 0)
        self.assertEqual(event["fuel_residual_mw"], 0)
        self.assertEqual(event["fuel_mw"]["Battery Storage"], -20)
        self.assertIsNone(event["fuel_mw"]["Nuclear"])

    def test_export_is_not_import(self):
        self.ingest([row(demand="90", exports="10")])
        self.assertEqual(self.report()["highest_demand_hours"][0]["net_imports_mw"], -10)
        self.assertEqual(self.report()["highest_net_import_hours"], [])

    def test_adjusted_is_never_substituted(self):
        self.ingest([row(demand="")])
        result = self.report()
        self.assertEqual(result["coverage"]["hours_with_demand"], 0)
        self.assertEqual(result["highest_demand_hours"], [])

    def test_revision_idempotency_reversion_and_last_seen(self):
        self.ingest([row()])
        later = self.source()
        self.assertEqual(self.ingest([row()], later)["new_or_revised"], 0)
        self.assertEqual(self.db.execute("SELECT last_seen_fetch_id FROM current").fetchone()[0], later)
        self.ingest([row(demand="115")], later)
        self.ingest([row()], self.source())
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM observations").fetchone()[0], 3)
        self.assertEqual(self.report()["highest_demand_hours"][0]["revision"], 3)

    def test_withdrawal_and_return_preserve_history(self):
        self.ingest([row(), row(hour=2)])
        self.assertEqual(self.ingest([row(hour=2)], self.source())["withdrawn"], 1)
        self.assertEqual(self.report()["coverage"]["balance_rows"], 1)
        self.ingest([row(), row(hour=2)], self.source())
        self.assertEqual(self.report()["coverage"]["balance_rows"], 2)
        self.assertEqual(self.db.execute("SELECT MAX(revision) FROM observations").fetchone()[0], 3)

    def test_invalid_file_does_not_partially_replace_good_history(self):
        self.ingest([row()])
        with self.assertRaises(ValueError):
            self.ingest([row(demand="115"), row(hour=2, demand="not a number")], self.source())
        self.assertEqual(self.report()["highest_demand_hours"][0]["demand_mw"], 110)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM observations").fetchone()[0], 1)

    def test_conflicting_duplicates_roll_back(self):
        with self.assertRaises(ValueError):
            self.ingest([row(), row(demand="111")])
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM observations").fetchone()[0], 0)

    def test_identical_duplicate_deduplicates(self):
        self.assertEqual(self.ingest([row(), row()])["selected_rows"], 1)

    def test_utc_key_preserves_repeated_local_hour(self):
        self.ingest([row(), row(hour=2)])
        self.assertEqual(self.report()["coverage"]["balance_rows"], 2)

    def test_ramp_uses_consecutive_hours_only(self):
        self.ingest([row(), row(hour=3, demand="150", generation="140")])
        self.assertEqual(self.report()["largest_upward_demand_ramps"], [])
        self.ingest([row(), row(hour=2), row(hour=3, demand="150", generation="140")])
        event = self.report()["largest_upward_demand_ramps"][0]
        self.assertEqual(event["change_from_previous_hour"]["demand_mw"], 40)

    def test_bad_accounting_is_counted_but_excluded_from_rankings(self):
        self.ingest([row(demand="300")])
        result = self.report()
        self.assertEqual(result["coverage"]["complete_but_excluded_hours"], 1)
        self.assertEqual(result["highest_demand_hours"], [])

    def test_partner_direction_and_residual(self):
        self.ingest([row()])
        self.ingest([{"Balancing Authority": "PACE", grid.UTC_COLUMN: "07/02/2026 1:00:00 AM",
                      grid.PARTNER: "IPCO", "Interchange (MW)": "-10"}], self.source("INTERCHANGE"), "INTERCHANGE")
        event = self.report()["highest_demand_hours"][0]
        self.assertEqual(event["counterparty_net_imports_mw"], {"IPCO": 10})
        self.assertEqual(event["counterparty_residual_mw"], 0)

    def test_future_fuel_names_are_preserved(self):
        self.ingest([row(**{grid.FUEL_PREFIX + "New Category": "3"})])
        self.assertEqual(self.report()["highest_demand_hours"][0]["fuel_mw"]["New Category"], 3)

    def test_finite_numbers_and_zero(self):
        self.assertIsNone(grid.number(" "))
        self.assertEqual(grid.number("0"), 0)
        self.assertEqual(grid.number("1,020.5"), 1020.5)
        for value in ("NaN", "Infinity", "--"):
            with self.assertRaises(ValueError):
                grid.number(value)

    def test_file_selection_includes_prior_local_half_at_utc_boundary(self):
        rows = [{"FILENAME": f"EIA930_{kind}_2026_{half}.csv", "YEAR": "2026", "PERIOD": str(period)}
                for kind in ("BALANCE", "INTERCHANGE") for period, half in ((1, "Jan_Jun"), (2, "Jul_Dec"))]
        self.assertEqual(len(grid.select_files(csv_bytes(rows), date(2026, 7, 1), date(2026, 7, 3))), 4)
        self.assertEqual(len(grid.select_files(csv_bytes(rows), date(2026, 7, 2), date(2026, 7, 3))), 2)
        with self.assertRaises(ValueError):
            grid.select_files(csv_bytes(rows[:1]), date(2026, 7, 2), date(2026, 7, 3))

    def test_source_failure_records_failed_run_and_preserves_data(self):
        self.ingest([row()])
        with patch.object(grid, "fetch", side_effect=OSError("offline")):
            result = grid.collect(self.db, self.path, ["PACE"], START, END)
        self.assertEqual(result["status"], "failed")
        self.assertEqual(self.report()["coverage"]["balance_rows"], 1)
        self.assertEqual(self.report()["latest_collection"]["status"], "failed")

    def test_empty_csv_does_not_withdraw_history(self):
        self.ingest([row()])
        with self.assertRaises(ValueError):
            grid.ingest(self.db, csv_bytes([], list(row())), "BALANCE", ["PACE"], START, END, self.source())
        self.assertEqual(self.report()["coverage"]["balance_rows"], 1)

    def test_schema_failure_leaves_history_untouched(self):
        self.ingest([row()])
        with self.assertRaises(ValueError):
            grid.ingest(self.db, b"surprise\nhtml\n", "BALANCE", ["PACE"], START, END, self.source())
        self.assertEqual(self.report()["coverage"]["balance_rows"], 1)

    def test_half_open_window_and_coverage(self):
        outside = row()
        outside[grid.UTC_COLUMN] = "07/03/2026 12:00:00 AM"
        self.ingest([row(), outside])
        result = self.report()
        self.assertEqual(result["coverage"]["expected_hours"], 24)
        self.assertEqual(result["coverage"]["balance_rows"], 1)

    def test_export_preserves_null_zero_and_provenance(self):
        self.ingest([row(exports="0", demand="100")])
        manifest = grid.export(self.db, self.path, ["PACE"], START, END)
        self.assertEqual(manifest["balance_rows"], 1)
        with (self.path / "exports/hourly-balance.csv").open(encoding="utf-8", newline="") as f:
            exported = next(csv.DictReader(f))
        self.assertEqual(float(exported["net_imports_mw"]), 0)
        self.assertIsNone(json.loads(exported["fuel_mw"])["Nuclear"])
        self.assertEqual(exported["source_sha256"], "fixture")

    def test_reconciled_source_spike_is_flagged_without_replacing_reported_value(self):
        self.ingest([row(demand="36258", generation="36080", exports="-178",
                         **{"Demand (MW) (Adjusted)": "6379"})])
        result = self.report()
        self.assertEqual(result["highest_demand_hours"], [])
        flagged = result["review_required_highest_reported_demand_hours"][0]
        self.assertEqual(flagged["balance_residual_mw"], 0)
        self.assertEqual(flagged["demand_mw"], 36258)
        self.assertEqual(flagged["eia_adjusted_reference_mw"]["demand_mw"], 6379)
        self.assertIn("eia_adjusted_demand_mw_differs", flagged["quality_flags"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
