#!/usr/bin/env python3
"""Collect, inspect, replay, or export the Salt Lake Valley rent pilot."""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from rent_tracker.collector import Fetcher, load_config
from rent_tracker.extract import extract
from rent_tracker.storage import Store, collection_lock

HERE = Path(__file__).resolve().parent
DEFAULT_DATA = HERE.parent.parent / "data" / "rent-tracker"


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["list", "collect", "report", "export", "replay"])
    parser.add_argument("--config", type=Path, default=HERE / "properties.json")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--property", action="append", dest="property_ids", help="Repeat to choose a cohort; default all registered properties")
    parser.add_argument("--source", help="Limit to this registered source ID")
    parser.add_argument("--delay", type=float, default=2.0, help="Minimum seconds between requests to one origin (at least 1)")
    parser.add_argument("--timeout", type=float, default=25.0)
    parser.add_argument("--strict", action="store_true", help="Exit 2 when any source needs attention; evidence still saved")
    parser.add_argument("--html", type=Path, help="Saved source HTML for replay; never fetched")
    parser.add_argument("--observed-at", help="Actual original capture time with UTC offset; required for replay")
    args = parser.parse_args(argv)
    config = load_config(args.config)
    if args.property_ids:
        known = {p["id"] for p in config["properties"]}
        unknown = set(args.property_ids) - known
        if unknown:
            parser.error("Unknown property IDs: " + ", ".join(sorted(unknown)))
        config["properties"] = [p for p in config["properties"] if p["id"] in args.property_ids]
    selected = [(p, s) for p in config["properties"] for s in p["sources"] if not args.source or s["id"] == args.source]
    if not selected:
        parser.error("No matching sources")
    config["run_selection"] = [{"property_id": p["id"], "source_id": s["id"]} for p, s in selected]
    if args.command == "list":
        print(json.dumps(config, indent=2))
        return 0
    if args.timeout <= 0 or args.timeout > 60:
        parser.error("--timeout must be between 0 and 60 seconds")
    if args.command == "replay":
        if len(selected) != 1 or not args.html or not args.observed_at:
            parser.error("replay requires --property, --source, --html and --observed-at selecting exactly one source")
        timestamp = datetime.fromisoformat(args.observed_at.replace("Z", "+00:00"))
        if timestamp.tzinfo is None:
            parser.error("--observed-at must include a UTC offset")
        args.observed_at = timestamp.astimezone(timezone.utc).isoformat(timespec="seconds")
    if args.command in {"report", "export"} and not (args.data_dir / "tracking.sqlite3").exists():
        parser.error("No tracking database yet; run collect first")
    # Serialize all database/artifact writers, including exports.
    with collection_lock(args.data_dir):
        store = Store(args.data_dir)
        try:
            if args.command == "report":
                print(json.dumps(store.report(), indent=2))
                return 0
            if args.command == "export":
                print(json.dumps(store.export(), indent=2))
                return 0
            run_id = store.start(config, "saved_html_replay" if args.command == "replay" else "http")
            fetcher = Fetcher(store, args.delay, args.timeout)
            failed = 0
            try:
                for prop, source in selected:
                    if args.command == "replay":
                        body = args.html.read_bytes()
                        try:
                            result = extract(body.decode("utf-8", "replace"), source["adapter"])
                        except (ValueError, KeyError, TypeError) as exc:
                            result = {"status": "parse_error", "error": str(exc)}
                        result.update(observed_at=args.observed_at, transport="saved_html_replay")
                    else:
                        result, body = fetcher.collect(source)
                    payload = store.capture(run_id, prop["id"], source, result, body)
                    if payload["status"] not in {"parsed", "signals_only"}:
                        failed += 1
                    print(f"{prop['id']}/{source['id']}: {payload['status']} ({len(payload.get('observations', []))} observations)", flush=True)
            finally:
                report = store.finish(run_id)
            print(json.dumps({"run_id": run_id, "status_counts": report["status_counts"],
                              "observation_counts": report["observation_counts"], "changes": len(report["changes"]),
                              "report": str(args.data_dir / "latest-run.json")}, indent=2))
            return 2 if args.strict and failed else 0
        finally:
            store.close()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, RuntimeError, OSError) as error:
        print(f"rent-tracker: {error}", file=sys.stderr)
        sys.exit(1)
