"""Keyless EIA-930 bulk-file archive and reported-value analysis (stdlib only)."""
from __future__ import annotations

import csv
import gzip
import hashlib
import io
import json
import math
import re
import sqlite3
import urllib.error
import urllib.request
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

BASE = "https://www.eia.gov/electricity/gridmonitor/sixMonthFiles/"
INDEX = BASE + "EIA930_File_List_Meta.csv"
AGENT = "GridHoursResearch/0.1 (public EIA-930 bulk data; daily archival research)"
UTC_COLUMN = "UTC Time at End of Hour"
PARTNER = "Directly Interconnected Balancing Authority"
FUEL_PREFIX = "Net Generation (MW) from "
MAIN = {"demand_mw": "Demand (MW)", "forecast_mw": "Demand Forecast (MW)",
        "generation_mw": "Net Generation (MW)", "net_exports_mw": "Total Interchange (MW)"}


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def digest(body):
    return hashlib.sha256(body).hexdigest()


def atomic_text(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(value, encoding="utf-8")
    temporary.replace(path)


def connect(data_dir):
    data_dir.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(data_dir / "grid.sqlite3", timeout=60)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript("""
      CREATE TABLE IF NOT EXISTS runs (
        id INTEGER PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT,
        start_utc TEXT NOT NULL, end_utc TEXT NOT NULL, regions_json TEXT NOT NULL,
        status TEXT NOT NULL, details_json TEXT);
      CREATE TABLE IF NOT EXISTS fetches (
        id INTEGER PRIMARY KEY, run_id INTEGER REFERENCES runs(id), fetched_at TEXT NOT NULL,
        url TEXT NOT NULL, sha256 TEXT NOT NULL, archive_path TEXT NOT NULL,
        transport_json TEXT NOT NULL, source_metadata_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS observations (
        id INTEGER PRIMARY KEY, kind TEXT NOT NULL, ba TEXT NOT NULL, hour_utc TEXT NOT NULL,
        partner TEXT NOT NULL, revision INTEGER NOT NULL, fetch_id INTEGER NOT NULL REFERENCES fetches(id),
        payload_sha256 TEXT NOT NULL, raw_json TEXT NOT NULL,
        UNIQUE(kind, ba, hour_utc, partner, revision));
      CREATE TABLE IF NOT EXISTS current (
        kind TEXT NOT NULL, ba TEXT NOT NULL, hour_utc TEXT NOT NULL, partner TEXT NOT NULL,
        observation_id INTEGER NOT NULL REFERENCES observations(id),
        last_seen_fetch_id INTEGER NOT NULL REFERENCES fetches(id),
        PRIMARY KEY(kind, ba, hour_utc, partner));
      CREATE INDEX IF NOT EXISTS current_window ON current(ba,kind,hour_utc);
    """)
    return db


def fetch(data_dir, url, limit=256 * 1024 * 1024):
    """Conditional GET; preserve exact response bytes compressed and hash-verified."""
    if not url.startswith(BASE) or "/" in url[len(BASE):]:
        raise ValueError("Only official EIA bulk filenames are supported")
    cache_path = data_dir / "cache" / (digest(url.encode()) + ".json")
    cached = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
    headers = {"User-Agent": AGENT, "Accept": "text/csv,text/plain,*/*"}
    if cached.get("etag"):
        headers["If-None-Match"] = cached["etag"]
    if cached.get("last_modified"):
        headers["If-Modified-Since"] = cached["last_modified"]
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=90) as response:
            if not response.geturl().startswith(BASE):
                raise ValueError("Unexpected download redirect")
            chunks, size = [], 0
            while chunk := response.read(1024 * 1024):
                size += len(chunk)
                if size > limit:
                    raise ValueError("Download exceeded size limit")
                chunks.append(chunk)
            body = b"".join(chunks)
            sha = digest(body)
            relative = f"raw/{sha}.csv.gz"
            path = data_dir / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            if not path.exists():
                temporary = path.with_suffix(".tmp")
                temporary.write_bytes(gzip.compress(body, mtime=0))
                temporary.replace(path)
            cached = {"sha256": sha, "archive_path": relative,
                      "etag": response.headers.get("ETag"),
                      "last_modified": response.headers.get("Last-Modified")}
            atomic_text(cache_path, canonical(cached))
            status = response.status
    except urllib.error.HTTPError as error:
        if error.code != 304 or not cached:
            raise
        body = gzip.decompress((data_dir / cached["archive_path"]).read_bytes())
        if digest(body) != cached["sha256"]:
            raise ValueError("Cached file failed SHA-256 verification") from error
        status = 304
    return body, {**cached, "http_status": status, "fetched_at": now(), "bytes": len(body)}


def select_files(body, start, end):
    """File partition is LOCAL data date, query window is UTC hour ending.

    Include the previous local day, especially at Jan/Jul boundaries.
    """
    reader = csv.DictReader(io.StringIO(body.decode("utf-8-sig")))
    if not {"FILENAME", "YEAR", "PERIOD"}.issubset(reader.fieldnames or []):
        raise ValueError("EIA file index schema changed")
    selected = {}
    lower = start - timedelta(days=1)
    for row in reader:
        match = re.fullmatch(r"EIA930_(BALANCE|INTERCHANGE)_(\d{4})_(Jan_Jun|Jul_Dec)\.csv", row["FILENAME"])
        if not match:
            continue
        kind, year, half = match.groups()
        year = int(year)
        left = date(year, 1 if half == "Jan_Jun" else 7, 1)
        right = date(year, 7, 1) if half == "Jan_Jun" else date(year + 1, 1, 1)
        if left < end and right > lower:
            selected[row["FILENAME"]] = (kind, row)
    # Detect missing advertised partitions instead of claiming a successful backfill.
    cursor = date(lower.year, 1 if lower.month <= 6 else 7, 1)
    while cursor < end:
        for kind in ("BALANCE", "INTERCHANGE"):
            name = f"EIA930_{kind}_{cursor.year}_{'Jan_Jun' if cursor.month == 1 else 'Jul_Dec'}.csv"
            if name not in selected:
                raise ValueError(f"Requested partition unavailable in EIA index: {name}")
        cursor = date(cursor.year, 7, 1) if cursor.month == 1 else date(cursor.year + 1, 1, 1)
    return [(kind, row) for _, (kind, row) in sorted(selected.items())]


def hour_utc(text):
    for fmt in ("%m/%d/%Y %I:%M:%S %p", "%m/%d/%Y %H:%M", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            value = datetime.strptime(text.strip(), fmt)
            if value.minute or value.second:
                raise ValueError("Hour-ending timestamp is not on an hour boundary")
            return value.isoformat(timespec="seconds") + "Z"
        except ValueError:
            pass
    raise ValueError(f"Unrecognized UTC hour ending: {text!r}")


def number(text):
    if text is None or not text.strip():
        return None
    value = float(text.replace(",", "").strip())
    if not math.isfinite(value):
        raise ValueError(f"Non-finite numeric value: {text!r}")
    return value


def save_fetch(db, run_id, url, transport, source_metadata):
    with db:
        return db.execute("""INSERT INTO fetches
          (run_id,fetched_at,url,sha256,archive_path,transport_json,source_metadata_json)
          VALUES (?,?,?,?,?,?,?)""", (run_id, transport["fetched_at"], url, transport["sha256"],
            transport["archive_path"], canonical(transport), canonical(source_metadata))).lastrowid


def upsert(db, key, row, fetch_id):
    payload = canonical(row)
    sha = digest(payload.encode())
    old = db.execute("""SELECT o.* FROM current c JOIN observations o ON o.id=c.observation_id
        WHERE c.kind=? AND c.ba=? AND c.hour_utc=? AND c.partner=?""", key).fetchone()
    if old and old["payload_sha256"] == sha:
        db.execute("UPDATE current SET last_seen_fetch_id=? WHERE kind=? AND ba=? AND hour_utc=? AND partner=?",
                   (fetch_id, *key))
        return False
    revision = old["revision"] + 1 if old else 1
    observation = db.execute("""INSERT INTO observations
        (kind,ba,hour_utc,partner,revision,fetch_id,payload_sha256,raw_json) VALUES (?,?,?,?,?,?,?,?)""",
        (*key, revision, fetch_id, sha, payload)).lastrowid
    db.execute("""INSERT INTO current VALUES (?,?,?,?,?,?) ON CONFLICT(kind,ba,hour_utc,partner)
        DO UPDATE SET observation_id=excluded.observation_id,last_seen_fetch_id=excluded.last_seen_fetch_id""",
        (*key, observation, fetch_id))
    return True


def ingest(db, body, kind, regions, start, end, fetch_id):
    reader = csv.DictReader(io.StringIO(body.decode("utf-8-sig"), newline=""))
    required = {"Balancing Authority", UTC_COLUMN}
    required |= set(MAIN.values()) if kind == "BALANCE" else {PARTNER, "Interchange (MW)"}
    if not required.issubset(reader.fieldnames or []):
        raise ValueError(f"{kind} schema missing {sorted(required - set(reader.fieldnames or []))}")
    numeric = [h for h in reader.fieldnames if "(MW)" in h]
    seen, changed, total = {}, 0, 0
    with db:  # An invalid selected row rolls back this whole file, not just that hour.
        for row in reader:
            total += 1
            if row["Balancing Authority"] not in regions:
                continue
            hour = hour_utc(row[UTC_COLUMN])
            if not start <= hour < end:
                continue
            if None in row or any(row.get(h) is None for h in reader.fieldnames):
                raise ValueError("Malformed CSV row")
            for field in numeric:
                number(row[field])
            partner = row[PARTNER].strip() if kind == "INTERCHANGE" else ""
            if kind == "INTERCHANGE" and not partner:
                raise ValueError("Missing interchange counterparty")
            key = (kind, row["Balancing Authority"], hour, partner)
            sha = digest(canonical(row).encode())
            if key in seen and seen[key] != sha:
                raise ValueError(f"Conflicting duplicate observation: {key}")
            if key not in seen:
                changed += upsert(db, key, row, fetch_id)
            seen[key] = sha
        if total == 0:
            raise ValueError("Empty EIA source file")
        # Withdrawals remain in history; current reports must not retain a removed row.
        source_url = db.execute("SELECT url FROM fetches WHERE id=?", (fetch_id,)).fetchone()[0]
        prior = db.execute("""SELECT c.*,o.raw_json FROM current c
            JOIN observations o ON o.id=c.observation_id JOIN fetches f ON f.id=o.fetch_id
            WHERE c.kind=? AND c.hour_utc>=? AND c.hour_utc<? AND f.url=?""",
            (kind, start, end, source_url)).fetchall()
        withdrawn = 0
        for item in prior:
            key = (item["kind"], item["ba"], item["hour_utc"], item["partner"])
            if item["ba"] in regions and key not in seen and not json.loads(item["raw_json"]).get("_withdrawn"):
                upsert(db, key, {"_withdrawn": True}, fetch_id)
                withdrawn += 1
    return {"selected_rows": len(seen), "new_or_revised": changed, "withdrawn": withdrawn}


def collect(db, data_dir, regions, start, end):
    with db:
        run_id = db.execute("""INSERT INTO runs(started_at,start_utc,end_utc,regions_json,status)
            VALUES (?,?,?,?,?)""", (now(), start, end, canonical(regions), "running")).lastrowid
    results, errors = [], []
    try:
        body, transport = fetch(data_dir, INDEX, limit=2 * 1024 * 1024)
        save_fetch(db, run_id, INDEX, transport, {})
        sources = select_files(body, date.fromisoformat(start[:10]), date.fromisoformat(end[:10]))
        for kind, metadata in sources:
            url = BASE + metadata["FILENAME"]
            print(f"Fetching {metadata['FILENAME']} ...", flush=True)
            try:
                body, transport = fetch(data_dir, url)
                fetch_id = save_fetch(db, run_id, url, transport, metadata)
                stats = ingest(db, body, kind, regions, start, end, fetch_id)
                results.append({"file": metadata["FILENAME"], "fetch_id": fetch_id,
                                "sha256": transport["sha256"], **stats})
            except (OSError, ValueError, csv.Error, urllib.error.URLError) as error:
                errors.append({"url": url, "error": str(error)})
    except (OSError, ValueError, csv.Error, urllib.error.URLError) as error:
        errors.append({"url": INDEX, "error": str(error)})
    details = {"run_id": run_id, "files": results, "errors": errors}
    status = "partial" if errors and results else "failed" if errors else "success"
    with db:
        db.execute("UPDATE runs SET finished_at=?,status=?,details_json=? WHERE id=?",
                   (now(), status, canonical(details), run_id))
    return {"status": status, **details}


def records(db, kind, ba, start, end):
    for record in db.execute("""SELECT c.*,o.revision,o.raw_json,f.fetched_at,f.url,f.sha256
        FROM current c JOIN observations o ON o.id=c.observation_id
        JOIN fetches f ON f.id=c.last_seen_fetch_id
        WHERE c.kind=? AND c.ba=? AND c.hour_utc>=? AND c.hour_utc<? ORDER BY c.hour_utc,c.partner""",
        (kind, ba, start, end)):
        row = json.loads(record["raw_json"])
        if not row.get("_withdrawn"):
            yield record, row


def balance(record, row):
    values = {key: number(row.get(column)) for key, column in MAIN.items()}
    fuels = {key[len(FUEL_PREFIX):]: number(value) for key, value in row.items()
             if key.startswith(FUEL_PREFIX) and not key.endswith(("(Adjusted)", "(Imputed)"))}
    demand, generation, exports = (values[k] for k in ("demand_mw", "generation_mw", "net_exports_mw"))
    residual = demand - generation + exports if all(x is not None for x in (demand, generation, exports)) else None
    subtotal = sum(x for x in fuels.values() if x is not None) if any(x is not None for x in fuels.values()) else None
    adjusted = {key: number(row.get(column + " (Adjusted)")) for key, column in MAIN.items() if key != "forecast_mw"}
    flags = []
    if residual is None:
        flags.append("missing_reported_balance")
    elif demand <= 0:
        flags.append("nonpositive_demand")
    elif abs(residual) > max(5, 0.01 * demand):
        flags.append("balance_does_not_reconcile")
    # A self-consistent row can still be erroneous: EIA may derive multiple totals
    # from one bad component. Use adjusted values as a review signal, never a fill.
    for key, value in adjusted.items():
        original = values[key]
        if original is not None and value is not None and abs(value - original) > max(5, 0.01 * abs(original)):
            flags.append(f"eia_adjusted_{key}_differs")
    return {"ba": record["ba"], "hour_ending_utc": record["hour_utc"], "basis": "reported",
            "local_hour_label_from_source": row.get("Local Time at End of Hour"), **values,
            "net_imports_mw": -exports if exports is not None else None,
            "balance_residual_mw": residual, "fuel_mw": fuels,
            "reported_fuel_subtotal_mw": subtotal,
            "fuel_residual_mw": generation - subtotal if generation is not None and subtotal is not None else None,
            "forecast_error_mw": demand - values["forecast_mw"] if demand is not None and values["forecast_mw"] is not None else None,
            "quality_flags": flags, "eia_adjusted_reference_mw": adjusted,
            "revision": record["revision"], "last_seen_at": record["fetched_at"],
            "source_url": record["url"], "source_sha256": record["sha256"]}


def valid_balance(row):
    return (row["demand_mw"] is not None and row["demand_mw"] > 0
            and row["balance_residual_mw"] is not None
            and abs(row["balance_residual_mw"]) <= max(5, 0.01 * row["demand_mw"])) and not row["quality_flags"]


def elapsed_hours(start, end):
    return int((datetime.fromisoformat(end.replace("Z", "+00:00")) -
                datetime.fromisoformat(start.replace("Z", "+00:00"))).total_seconds() / 3600)


def report(db, ba, start, end, top=10):
    rows = [balance(record, row) for record, row in records(db, "BALANCE", ba, start, end)]
    by_hour = {row["hour_ending_utc"]: row for row in rows}
    eligible = [row for row in rows if valid_balance(row)]
    flow_hours = {}
    for record, row in records(db, "INTERCHANGE", ba, start, end):
        value = number(row["Interchange (MW)"])
        flow_hours.setdefault(record["hour_utc"], {})[record["partner"]] = -value if value is not None else None

    def event(row):
        hour = row["hour_ending_utc"]
        previous = (datetime.fromisoformat(hour.replace("Z", "+00:00")) - timedelta(hours=1)).isoformat().replace("+00:00", "Z")
        prior = by_hour.get(previous)
        deltas = None
        if prior and valid_balance(prior):
            fields = ("demand_mw", "generation_mw", "net_imports_mw")
            deltas = {key: row[key] - prior[key] for key in fields}
            deltas["fuel_mw"] = {key: value - prior["fuel_mw"][key]
                if value is not None and prior["fuel_mw"].get(key) is not None else None
                for key, value in row["fuel_mw"].items()}
        flows = flow_hours.get(hour, {})
        complete = bool(flows) and all(value is not None for value in flows.values())
        subtotal = sum(flows.values()) if complete else None
        return {**row, "change_from_previous_hour": deltas, "counterparty_net_imports_mw": flows,
                "reported_counterparty_sum_mw": subtotal,
                "counterparty_residual_mw": row["net_imports_mw"] - subtotal if subtotal is not None else None}

    enriched = [event(row) for row in eligible]
    ramp = [row for row in enriched if row["change_from_previous_hour"] and row["change_from_previous_hour"]["demand_mw"] > 0]
    last_run = db.execute("SELECT * FROM runs ORDER BY id DESC LIMIT 1").fetchone()
    expected = elapsed_hours(start, end)
    complete = [row for row in rows if row["balance_residual_mw"] is not None]
    return {"generated_at": now(), "ba": ba, "start_utc_inclusive": start, "end_utc_exclusive": end,
            "basis": "EIA reported values; adjusted/imputed columns retained in archive but not substituted",
            "ranking_rule": "Positive demand; demand/generation/interchange present; absolute balance residual <= max(5 MW, 1% of demand); no reported/adjusted balance-series difference > max(5 MW, 1% of absolute reported value)",
            "interpretation": "Candidate high-demand/import/ramp hours, not proof of emergency, avoided outage, marginal fuel, or causal dependence.",
            "coverage": {"expected_hours": expected, "balance_rows": len(rows),
                "hours_with_demand": sum(row["demand_mw"] is not None for row in rows),
                "complete_balance_hours": len(complete), "ranking_eligible_hours": len(eligible),
                "complete_balance_percent": round(100 * len(complete) / expected, 2) if expected else 0,
                "complete_but_excluded_hours": len(complete) - len(eligible),
                "quality_flag_counts": dict(Counter(flag for row in rows for flag in row["quality_flags"])),
                "hours_with_any_reported_fuel": sum(any(v is not None for v in r["fuel_mw"].values()) for r in rows),
                "hours_with_counterparty_rows": len(flow_hours),
                "latest_complete_balance_hour": complete[-1]["hour_ending_utc"] if complete else None,
                "maximum_absolute_balance_residual_mw": max((abs(r["balance_residual_mw"]) for r in complete), default=None)},
            "latest_collection": dict(last_run) if last_run else None,
            "review_required_highest_reported_demand_hours": sorted((row for row in rows if row["quality_flags"] and row["demand_mw"] is not None), key=lambda row: row["demand_mw"], reverse=True)[:top],
            "highest_demand_hours": sorted(enriched, key=lambda row: row["demand_mw"], reverse=True)[:top],
            "highest_net_import_hours": sorted((r for r in enriched if r["net_imports_mw"] > 0), key=lambda row: row["net_imports_mw"], reverse=True)[:top],
            "largest_upward_demand_ramps": sorted(ramp, key=lambda row: row["change_from_previous_hour"]["demand_mw"], reverse=True)[:top]}


def write_csv(path, fields, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    with temporary.open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: canonical(row[key]) if isinstance(row[key], (dict, list)) else row[key] for key in fields})
    temporary.replace(path)


def export(db, data_dir, regions, start, end):
    destination = data_dir / "exports"
    rows = [balance(rec, row) for ba in regions for rec, row in records(db, "BALANCE", ba, start, end)]
    fields = ["ba", "hour_ending_utc", "basis", "local_hour_label_from_source", *MAIN,
              "net_imports_mw", "balance_residual_mw", "fuel_mw", "reported_fuel_subtotal_mw",
              "fuel_residual_mw", "forecast_error_mw", "quality_flags", "eia_adjusted_reference_mw",
              "revision", "last_seen_at", "source_url", "source_sha256"]
    write_csv(destination / "hourly-balance.csv", fields, rows)
    flows = []
    for ba in regions:
        for rec, row in records(db, "INTERCHANGE", ba, start, end):
            value = number(row["Interchange (MW)"])
            flows.append({"ba": ba, "hour_ending_utc": rec["hour_utc"], "partner": rec["partner"],
                          "net_exports_mw": value, "net_imports_mw": -value if value is not None else None,
                          "revision": rec["revision"], "source_sha256": rec["sha256"],
                          "last_seen_at": rec["fetched_at"], "source_url": rec["url"]})
    write_csv(destination / "hourly-interchange.csv", ["ba", "hour_ending_utc", "partner", "net_exports_mw",
              "net_imports_mw", "revision", "source_sha256", "last_seen_at", "source_url"], flows)
    manifest = {"generated_at": now(), "start_utc_inclusive": start, "end_utc_exclusive": end,
                "regions": regions, "balance_rows": len(rows), "interchange_rows": len(flows),
                "coverage": {ba: report(db, ba, start, end, top=1)["coverage"] for ba in regions}}
    atomic_text(destination / "manifest.json", json.dumps(manifest, indent=2))
    return manifest
