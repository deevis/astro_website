#!/usr/bin/env python3
"""Run from anywhere; all default paths are relative to this script, not cwd."""
import argparse
import json
import re
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from grid_tracker import atomic_text, collect, connect, export, report

ROOT = Path(__file__).resolve().parent
REGISTRY = json.loads((ROOT / "regions.json").read_text(encoding="utf-8"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("list", "collect", "report", "export"))
    parser.add_argument("--data-dir", type=Path, default=ROOT.parent.parent / "data" / "grid-tracker")
    parser.add_argument("--regions", default=",".join(r["code"] for r in REGISTRY["regions"]))
    parser.add_argument("--ba", default=REGISTRY["focus"], help="Focus balancing authority for report")
    parser.add_argument("--days", type=int, default=45, help="Rolling UTC days, default 45")
    parser.add_argument("--start", type=date.fromisoformat, help="Inclusive UTC hour-ending date, YYYY-MM-DD")
    parser.add_argument("--end", type=date.fromisoformat, help="Exclusive UTC hour-ending date, default today UTC")
    args = parser.parse_args()
    if args.command == "list":
        print(json.dumps(REGISTRY, indent=2))
        return 0
    if args.days < 1:
        parser.error("--days must be positive")
    end = args.end or datetime.now(timezone.utc).date()
    start = args.start or end - timedelta(days=args.days)
    if start >= end:
        parser.error("--start must precede --end")
    regions = list(dict.fromkeys(code.strip().upper() for code in args.regions.split(",")))
    args.ba = args.ba.upper()
    if any(not re.fullmatch(r"[A-Z0-9]{2,8}", code) for code in [*regions, args.ba]):
        parser.error("Invalid balancing authority code")
    start, end = start.isoformat() + "T00:00:00Z", end.isoformat() + "T00:00:00Z"
    data_dir = args.data_dir.resolve()
    if args.command != "collect" and not (data_dir / "grid.sqlite3").exists():
        parser.error("No archive exists yet; run collect first")
    db = connect(data_dir)
    try:
        if args.command == "collect":
            result = collect(db, data_dir, regions, start, end)
        elif args.command == "report":
            result = report(db, args.ba, start, end)
            result["boundary_notes"] = REGISTRY["boundary_notes"]
            atomic_text(data_dir / "exports" / f"{args.ba}-report.json", json.dumps(result, indent=2))
        else:
            result = export(db, data_dir, regions, start, end)
        print(json.dumps(result, indent=2))
        return 2 if result.get("status") in ("partial", "failed") else 0
    finally:
        db.close()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError) as error:
        print(f"grid-tracker: {error}", file=sys.stderr)
        sys.exit(1)
