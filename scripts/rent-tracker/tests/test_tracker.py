"""Offline contract tests for data-quality failures that could alter the article."""

import gzip
import json
import tempfile
import unittest
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from rent_tracker.collector import Fetcher, load_config
from rent_tracker.extract import extract, price_fields
from rent_tracker.storage import Store, collection_lock


def spaces_page(price=1500, total_items=2, unit_id="unit-01"):
    # Synthetic fixtures, deliberately independent of live rents and source availability.
    unit = {"id": unit_id, "unit_number": "101", "plan_name": "Example studio", "bedroom_count": "0",
            "bathroom_count": 1, "area": "500", "price": price, "price_with_fees": price + 80,
            "unit_fees": 80, "price_lease_term": "3", "default_lease_term": "15",
            "available_on": "2026-10-01", "available_on_string": "Oct 1", "is_available": True,
            "lease_terms": [{"lease_term": "12", "price": str(price + 50)}]}
    data = {"units": {"data": [unit], "pagination": {"current_page": 1, "total_items": total_items, "total_pages": total_items}}}
    return "<html><script>SPACES.initialData = " + json.dumps(data) + ";</script></html>"


class ExtractionTests(unittest.TestCase):
    def test_partial_inventory_preserves_term_prices_and_unknown_concession(self):
        result = extract(spaces_page(), "spaces_json")
        row = result["observations"][0]
        self.assertEqual(result["inventory_completeness"], "partial")
        self.assertEqual(result["source_total"], 2)
        self.assertEqual(row["bedrooms"], 0)
        self.assertEqual(row["base_rent"], 1500)
        self.assertEqual(row["total_monthly_price"], 1580)
        self.assertEqual(row["lease_months"], 3)
        self.assertEqual(row["default_lease_months"], 15)
        self.assertEqual(row["lease_quotes"], [{"lease_months": 12, "base_rent": 1550}])
        self.assertIsNone(row["effective_monthly_cost"])

    def test_floorplan_duplicates_are_not_extra_units(self):
        html = """<h2>Example</h2><p>Studio / 1 Bath 500 Sq. Ft. Starting at $1,400.00 /mo</p>
            <h2>Example</h2><p>Studio 1 Bath 500 Sq. Ft. $1,400.00 to-$1,800.00/ month Available On: Available Now</p>"""
        result = extract(html, "floorplan_headings")
        self.assertEqual(len(result["observations"]), 1)
        row = result["observations"][0]
        self.assertEqual(row["scope"], "floorplan")
        self.assertIsNone(row["unit_number"])
        self.assertIsNone(row["base_rent"])
        self.assertEqual(row["advertised_rent_max"], 1800)

    def test_explicit_total_and_base_prices_stay_separate(self):
        fields = price_fields("Total Monthly Leasing Price Starting at $1,342.00 Base rent $1,230.00 · 13-month term")
        self.assertEqual(fields["base_rent"], 1230)
        self.assertEqual(fields["total_monthly_price"], 1342)
        self.assertEqual(fields["lease_months"], 13)

    def test_disagreeing_duplicate_prices_are_not_silently_merged(self):
        html = "<h2>Example</h2><p>1 Bed 1 Bath 500 Sq. Ft. Starting at $1,400</p><h2>Example</h2><p>1 Bed 1 Bath 500 Sq. Ft. $1,600/month</p>"
        with self.assertRaisesRegex(ValueError, "disagree"):
            extract(html, "floorplan_headings")

    def test_ranges_do_not_turn_into_fixed_term_or_area(self):
        html = "<h2>Example</h2><p>2 Beds 2 Baths 1,021-to 1,068 Sq. Ft. $1,700/month 12-13mo lease</p>"
        row = extract(html, "floorplan_headings")["observations"][0]
        self.assertIsNone(row["lease_months"])
        self.assertEqual(row["lease_months_min"], 12)
        self.assertEqual(row["lease_months_max"], 13)
        self.assertIsNone(row["sqft"])
        self.assertEqual(row["sqft_min"], 1021)
        self.assertEqual(row["sqft_max"], 1068)

    def test_promotion_is_not_assigned_to_unit(self):
        html = spaces_page() + "<p>Up to 8 weeks free on select units. Minimum lease term applies.</p>"
        result = extract(html, "spaces_json")
        self.assertEqual(len(result["signals"]), 1)
        self.assertIn("select units", result["signals"][0]["text"])
        self.assertIsNone(result["observations"][0]["effective_monthly_cost"])

    def test_price_filters_and_deposits_are_not_concessions_or_rent(self):
        html = "<div>Prices $1,000-$1,500 Move-in Date</div><h2>Example</h2><p>1 Bed 1 Bath 500 Sq. Ft. Deposit $250 Contact Us</p>"
        result = extract(html, "floorplan_headings")
        self.assertEqual(result["signals"], [])
        self.assertIsNone(result["observations"][0]["advertised_rent_min"])

    def test_challenge_and_empty_inventory_are_errors(self):
        for html in ["<title>Just a moment...</title>", "<p>No matching units</p>"]:
            with self.assertRaises(ValueError):
                extract(html, "floorplan_headings")

    def test_unit_table_rent_is_not_deposit_and_ids_preserved(self):
        html = """<div class="floorplan-section"><h2>Example</h2><p>2 Bedrooms | 1.5 Bathrooms</p>
        <table><tr><th>Apartment</th><th>Sq. Ft.</th><th>Rent</th><th>Date Available</th><th>Deposit</th></tr>
        <tr><td>Apartment: #A-101</td><td>974</td><td>$1,565.00 to -$1,618.00</td><td>Available</td><td>$300</td></tr></table></div>"""
        row = extract(html, "unit_table")["observations"][0]
        self.assertEqual(row["listing_id"], "A-101")
        self.assertEqual(row["advertised_rent_min"], 1565)
        self.assertEqual(row["advertised_rent_max"], 1618)
        self.assertEqual(row["floorplan"], "Example")
        self.assertEqual(row["bedrooms"], 2)
        self.assertEqual(row["bathrooms"], 1.5)
        self.assertIsNone(row["mandatory_monthly_fees"])


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(self.temp.name)
        self.source = {"id": "inventory", "url": "https://example.org/units", "adapter": "spaces_json"}
        self.config = {"properties": [{"id": "example", "name": "Example", "city": "Test", "sources": [self.source]}]}

    def tearDown(self):
        self.store.close()
        self.temp.cleanup()

    def add(self, html, timestamp):
        run = self.store.start(self.config)
        data = extract(html, "spaces_json")
        data["observed_at"] = timestamp
        self.store.capture(run, "example", self.source, data, html.encode())
        return self.store.finish(run)

    def test_failures_preserve_history_and_partial_snapshots_never_remove_units(self):
        self.add(spaces_page(), "2026-09-20T12:00:00+00:00")
        failed = self.store.start(self.config)
        self.store.capture(failed, "example", self.source, {"status": "http_error", "http_status": 403})
        report = self.store.finish(failed)
        self.assertEqual(report["observation_counts"], {})
        self.assertEqual(report["changes"], [])
        self.add(spaces_page(unit_id="unit-02"), "2026-09-21T12:00:00+00:00")
        self.assertEqual(self.store.db.execute("SELECT COUNT(*) FROM observations").fetchone()[0], 2)

    def test_changes_require_existing_identity_and_preserve_prior_value(self):
        self.add(spaces_page(), "2026-09-20T12:00:00+00:00")
        report = self.add(spaces_page(1450), "2026-09-21T12:00:00+00:00")
        self.assertEqual(report["changes"][0]["differences"]["base_rent"], {"before": 1500, "after": 1450})
        self.assertEqual(report["changes"][0]["comparison_quality"], "context_unverified")
        self.assertEqual(self.store.export()["observations"], 2)

    def test_repeated_content_retains_both_observations_but_deduplicates_evidence(self):
        html = spaces_page()
        self.add(html, "2026-09-20T12:00:00+00:00")
        report = self.add(html, "2026-09-21T12:00:00+00:00")
        files = list(Path(self.temp.name).glob("raw/*/*.gz"))
        self.assertEqual(len(files), 1)
        self.assertEqual(gzip.decompress(files[0].read_bytes()), html.encode())
        self.assertEqual(report["changes"], [])
        self.assertEqual(self.store.export()["observations"], 2)

    def test_lock_blocks_overlapping_runs(self):
        with collection_lock(self.temp.name):
            with self.assertRaises(RuntimeError):
                with collection_lock(self.temp.name):
                    self.fail("Second collector entered lock")

    def test_replay_cannot_pollute_live_archive(self):
        self.add(spaces_page(), "2026-09-20T12:00:00+00:00")
        with self.assertRaisesRegex(ValueError, "separate"):
            self.store.start(self.config, "saved_html_replay")


class FetchTests(unittest.TestCase):
    def test_robots_denial_does_not_fetch_page(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = Store(tmp)
            try:
                fetcher = Fetcher(store)
                with patch.object(fetcher, "request", return_value={"status": "fetched", "http_status": 200, "body": b"User-agent: *\nDisallow: /units"}) as request:
                    result, body = fetcher.collect({"url": "https://example.org/units", "adapter": "spaces_json"})
                    self.assertEqual(result["status"], "robots_disallowed")
                    self.assertIsNone(body)
                    self.assertEqual(request.call_count, 1)
            finally:
                store.close()

    def test_failed_robots_and_blocked_host_do_not_fetch_inventory(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = Store(tmp)
            try:
                fetcher = Fetcher(store)
                with patch.object(fetcher, "request", return_value={"status": "http_error", "http_status": 403, "body": b"Denied"}) as request:
                    result, _ = fetcher.collect({"url": "https://example.org/units", "adapter": "spaces_json"})
                    self.assertEqual(result["status"], "robots_unavailable")
                    self.assertEqual(request.call_count, 1)
                    fetcher.blocked.add("https://example.org")
                    result, _ = fetcher.collect({"url": "https://example.org/other", "adapter": "signals"})
                    self.assertEqual(result["status"], "host_backoff")
                    self.assertEqual(request.call_count, 1)
            finally:
                store.close()

    def test_registry_has_valley_coverage_and_no_duplicate_sources(self):
        config = load_config(Path(__file__).resolve().parents[1] / "properties.json")
        self.assertEqual(len(config["properties"]), 16)
        self.assertEqual(len({p["city"] for p in config["properties"]}), 10)


if __name__ == "__main__":
    unittest.main()
