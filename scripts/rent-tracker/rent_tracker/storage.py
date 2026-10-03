"""Append-only observations and content-addressed, compressed source evidence."""

import csv
import gzip
import hashlib
import json
import os
import sqlite3
import uuid
from collections import Counter
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from . import VERSION
from .extract import PARSER_VERSION


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + "." + uuid.uuid4().hex + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(temporary, path)


@contextmanager
def collection_lock(directory):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    lock = directory / "collector.lock"
    try:
        descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError as exc:
        raise RuntimeError(f"Collection lock exists: {lock}. Check for a running collector before removing a stale lock.") from exc
    try:
        with os.fdopen(descriptor, "w") as stream:
            stream.write(json.dumps({"pid": os.getpid(), "started_at": utc_now()}))
        yield
    finally:
        lock.unlink(missing_ok=True)


class Store:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(self.directory / "tracking.sqlite3")
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.executescript("""
            CREATE TABLE IF NOT EXISTS runs (
                id TEXT PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT,
                mode TEXT NOT NULL, collector_version TEXT NOT NULL, config_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS captures (
                id INTEGER PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id),
                property_id TEXT NOT NULL, source_id TEXT NOT NULL, observed_at TEXT NOT NULL,
                url TEXT NOT NULL, status TEXT NOT NULL, raw_sha256 TEXT, payload_json TEXT NOT NULL,
                UNIQUE(run_id, property_id, source_id)
            );
            CREATE TABLE IF NOT EXISTS observations (
                id INTEGER PRIMARY KEY, capture_id INTEGER NOT NULL REFERENCES captures(id),
                property_id TEXT NOT NULL, source_id TEXT NOT NULL, scope TEXT NOT NULL,
                listing_id TEXT NOT NULL, observed_at TEXT NOT NULL, payload_json TEXT NOT NULL,
                UNIQUE(capture_id, scope, listing_id)
            );
            CREATE INDEX IF NOT EXISTS listing_history ON observations(property_id, source_id, scope, listing_id, observed_at);
        """)

    def close(self):
        self.db.close()

    def start(self, config, mode="http"):
        existing_modes = {row[0] for row in self.db.execute("SELECT DISTINCT mode FROM runs")}
        if existing_modes - {mode}:
            raise ValueError("Live collection and saved-HTML replay require separate --data-dir archives")
        run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]
        with self.db:
            self.db.execute("INSERT INTO runs VALUES (?, ?, NULL, ?, ?, ?)",
                            (run_id, utc_now(), mode, VERSION, json.dumps(config, sort_keys=True)))
        return run_id

    def archive(self, body):
        digest = hashlib.sha256(body).hexdigest()
        path = self.directory / "raw" / digest[:2] / (digest + ".gz")
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_suffix(".tmp")
            temporary.write_bytes(gzip.compress(body, mtime=0))
            os.replace(temporary, path)
        return digest

    def capture(self, run_id, property_id, source, result, body=None):
        payload = dict(result, parser_version=PARSER_VERSION, adapter=source["adapter"])
        payload["raw_sha256"] = self.archive(body) if body is not None else None
        observed_at = payload.get("observed_at") or utc_now()
        payload["observed_at"] = observed_at
        with self.db:
            cursor = self.db.execute("INSERT INTO captures(run_id, property_id, source_id, observed_at, url, status, raw_sha256, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (run_id, property_id, source["id"], observed_at, source["url"], payload["status"], payload["raw_sha256"], json.dumps(payload)))
            for row in payload.get("observations", []):
                self.db.execute("INSERT INTO observations(capture_id, property_id, source_id, scope, listing_id, observed_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (cursor.lastrowid, property_id, source["id"], row["scope"], row["listing_id"], observed_at, json.dumps(row)))
        return payload

    def finish(self, run_id):
        with self.db:
            self.db.execute("UPDATE runs SET finished_at=? WHERE id=?", (utc_now(), run_id))
        report = self.report(run_id)
        atomic_json(self.directory / "runs" / (run_id + ".json"), report)
        atomic_json(self.directory / "latest-run.json", report)
        return report

    def report(self, run_id=None):
        if run_id is None:
            row = self.db.execute("SELECT id FROM runs ORDER BY started_at DESC, rowid DESC LIMIT 1").fetchone()
            if row is None:
                return {"runs": 0, "captures": []}
            run_id = row[0]
        run = self.db.execute("SELECT * FROM runs WHERE id=?", (run_id,)).fetchone()
        if run is None:
            raise ValueError("Unknown run ID")
        config = json.loads(run["config_json"])
        properties = {p["id"]: p for p in config["properties"]}
        captures = []
        for entry in self.db.execute("SELECT * FROM captures WHERE run_id=? ORDER BY id", (run_id,)):
            payload = json.loads(entry["payload_json"])
            counts = Counter(o["scope"] for o in payload.get("observations", []))
            captures.append({"property_id": entry["property_id"], "property_name": properties[entry["property_id"]]["name"],
                "city": properties[entry["property_id"]]["city"], "source_id": entry["source_id"], "url": entry["url"],
                **{k: v for k, v in payload.items() if k != "observations"}, "observation_counts": dict(counts)})
        expected = len(config.get("run_selection", [(p["id"], s["id"]) for p in config["properties"] for s in p["sources"]]))
        return {"run_id": run_id, "started_at": run["started_at"], "finished_at": run["finished_at"], "mode": run["mode"],
                "expected_sources": expected, "attempted_sources": len(captures),
                "all_sources_attempted": expected == len(captures),
                "collector_version": run["collector_version"], "status_counts": dict(Counter(c["status"] for c in captures)),
                "observation_counts": dict(sum((Counter(c["observation_counts"]) for c in captures), Counter())),
                "captures": captures, "changes": self.changes(run_id),
                "interpretation": "Observed advertisements only. Missing listings are not inferred to be leased; failed or partial captures are not zero inventory."}

    def changes(self, run_id):
        changes = []
        fields = ("advertised_rent_min", "advertised_rent_max", "price_basis", "base_rent", "total_monthly_price", "mandatory_monthly_fees", "lease_months", "available_on", "availability_text", "lease_quotes")
        current = self.db.execute("SELECT o.* FROM observations o JOIN captures c ON c.id=o.capture_id WHERE c.run_id=? ORDER BY o.id", (run_id,)).fetchall()
        for item in current:
            previous = self.db.execute("""SELECT * FROM observations WHERE property_id=? AND source_id=? AND scope=? AND listing_id=?
                AND observed_at < ? ORDER BY observed_at DESC, id DESC LIMIT 1""",
                (item["property_id"], item["source_id"], item["scope"], item["listing_id"], item["observed_at"])).fetchone()
            if previous is None:
                continue
            versions = [json.loads(self.db.execute("SELECT payload_json FROM captures WHERE id=?", (capture_id,)).fetchone()[0]).get("parser_version")
                        for capture_id in (previous["capture_id"], item["capture_id"])]
            # Extraction changes need a separate audit; they are not market changes.
            if versions[0] != versions[1]:
                continue
            before, after = json.loads(previous["payload_json"]), json.loads(item["payload_json"])
            differences = {key: {"before": before.get(key), "after": after.get(key)} for key in fields if before.get(key) != after.get(key)}
            if differences:
                changes.append({"property_id": item["property_id"], "source_id": item["source_id"], "scope": item["scope"],
                    "listing_id": item["listing_id"], "previous_observed_at": previous["observed_at"],
                    "observed_at": item["observed_at"], "type": "advertisement_changed", "differences": differences,
                    "comparison_quality": "context_unverified", "note": "Website defaults may change term, move-in date, or price basis. Review before calling this a rent change."})
        return changes

    def export(self):
        rows = []
        for row in self.db.execute("""SELECT o.*, c.url, c.raw_sha256, c.run_id, c.payload_json AS capture_json, r.mode
                                  FROM observations o JOIN captures c ON c.id=o.capture_id JOIN runs r ON r.id=c.run_id ORDER BY o.observed_at, o.id"""):
            capture = json.loads(row["capture_json"])
            rows.append({"run_id": row["run_id"], "collection_mode": row["mode"], "property_id": row["property_id"], "source_id": row["source_id"],
                         "observed_at": row["observed_at"], "source_url": row["url"], "raw_sha256": row["raw_sha256"],
                         "parser_version": capture.get("parser_version"), "adapter": capture.get("adapter"),
                         "inventory_completeness": capture.get("inventory_completeness"),
                         **json.loads(row["payload_json"])})
        output = self.directory / "exports"
        atomic_json(output / "observations.json", rows)
        path = output / "observations.csv"
        keys = list(dict.fromkeys(key for row in rows for key in row))
        temporary = path.with_suffix(".csv.tmp")
        with temporary.open("w", encoding="utf-8", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=keys)
            writer.writeheader()
            for row in rows:
                cells = {key: json.dumps(value) if isinstance(value, (dict, list)) else value for key, value in row.items()}
                # Prevent scraped text from becoming spreadsheet formulas.
                cells = {key: "'" + value if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")) else value for key, value in cells.items()}
                writer.writerow(cells)
        os.replace(temporary, path)
        return {"observations": len(rows), "json": str(output / "observations.json"), "csv": str(path)}
