# Salt Lake Valley rent tracker

A working collection scaffold for the future rent article. Python 3.10+ and the standard library are sufficient. No account, API key, Python package installation, or running Astro server is required.

The initial registry contains **16 communities in 10 cities**. It mixes individual-unit sources, floorplan sources, and promotion-only homepages. This is an intentionally small, purposive pilot; it is not a valley rent index.

Read [RESEARCH.md](RESEARCH.md) for the source findings, sampling limitations, article questions, and next adapters to build.

## Run from the repository root

```powershell
# Inspect the source registry without making requests or creating data.
python scripts/rent-tracker/track.py list

# Collect every registered source once.
python scripts/rent-tracker/track.py collect

# Collect only the original two properties.
python scripts/rent-tracker/track.py collect --property 4th-west --property liberty-blvd

# Read the latest run, including blocked sources and coverage limitations.
python scripts/rent-tracker/track.py report

# Export all stored observations for analysis.
python scripts/rent-tracker/track.py export

# Offline tests; no network required.
python scripts/rent-tracker/tests/test_tracker.py
```

Equivalent npm scripts: `rent:list`, `rent:collect`, `rent:report`, `rent:export`, and `test:rent`. The direct Python commands also work when npm is unavailable.

Use `--data-dir D:\research\salt-lake-rents` to keep the archive elsewhere. Use `--source inventory` to restrict a run to inventory pages. `--property` may be repeated. Unknown property/source selections fail rather than silently collecting nothing.

## What is implemented

1. Load explicitly researched URLs from `properties.json`; no unbounded crawling.
2. Check each origin's robots file and respect its matching rules and crawl delay. Unavailable robots files produce a recorded gap. No login, cookies, application submission, CAPTCHA handling, or access-control workaround is implemented.
3. Fetch source HTML with an identifiable research user agent, per-origin pacing, a timeout, and an 8 MiB limit. A 401, 403, or 429 stops further requests to that origin for this run. Cross-origin redirects require registry review.
4. Save successful responses and HTTP error bodies as SHA-256-addressed gzip files. Identical bodies reuse the same evidence file; repeated observations still retain their own timestamps.
5. Parse explicitly supported structures. Missing structures become `parse_error`, not zero inventory.
6. Append capture metadata and observations to SQLite. A transaction keeps each capture and its observations together. An exclusive lock prevents overlapping writers.
7. Write a report for the run. Changes compare the same property, source, scope, and listing identity against the preceding observation. Different parser versions are not compared as market changes.
8. Export JSON and spreadsheet-safe CSV with source URLs, raw hashes, timestamps, adapters, parser versions, and coverage labels.

## Source adapters

| Adapter | Current role | Coverage boundary |
| --- | --- | --- |
| `spaces_json` | 4th West's embedded `SPACES.initialData` | Individual units, base and total prices, fees, separate term-specific quotes. Initial page is paginated. |
| `spaces_html` | thePEARL's server-rendered SPACES cards | Floorplans, explicit base/total prices and terms, advertised unit counts; not unit identities. |
| `floorplan_headings` | Liberty Blvd and similar RentCafe/Entrata pages | Conservative heading/price extraction; duplicate dialog cards are merged. Requires per-site validation as layouts change. |
| `unit_table` | Sunset Ridge's available-units tables | Unit numbers, floorplan context, prices and dates; total inventory completeness remains unknown. |
| `signals` | Property homepages | Promotion text for human eligibility review; no rent or vacancy inference. |

The generic floorplan adapter is provisional on sources whose automated access failed. A successful parse means recognized records were extracted; it is not a guarantee that every record on the site was captured.

## Archive layout

```text
data/rent-tracker/
  tracking.sqlite3            # Runs, captures, observations; never replaced by a failed scrape
  raw/ab/<sha256>.gz           # Exact response bytes, including robots evidence
  runs/<run-id>.json           # Per-run health, counts, signals, changes, evidence references
  latest-run.json              # Convenience report for the most recent run, possibly a subset
  exports/observations.json    # All historical observation rows
  exports/observations.csv
```

The archive is gitignored and lives outside `public/`. It will not ship with the Astro website. Back up the entire directory: raw evidence is necessary for re-extraction, and the database holds collection history. For a consistent simple backup, copy it between runs while no collector/export writer is active. Do not place the live SQLite database on an unreliable network share.

Each run saves its selected registry configuration. `expected_sources`, `attempted_sources`, and `all_sources_attempted` distinguish a finished cohort from an interrupted run. Capture status counts distinguish extraction success from HTTP and robots failures.

## Data interpretation

- `scope=unit` and `scope=floorplan` are distinct. A floorplan's starting price is not a lease quote for a particular apartment.
- Blank fees, unknown terms, and undisclosed rents remain null. They are not zero. Some floorplan rows are unpriced.
- `advertised_rent_min/max` describe a displayed price/range. `base_rent` and `total_monthly_price` are populated only when the reviewed source structure labels them. Never pool the two price bases.
- `lease_months` is the term attached to the displayed price. `default_lease_months` is kept separately when a source exposes a different UI default. `lease_quotes` preserves explicit alternatives without assigning the displayed fees to every term.
- Term and area ranges stay ranges. A 12–13 month offer is not a confirmed 13-month quote.
- Promotions are saved with nearby conditions and `eligibility=unverified`. Text may be present in a site's hidden dialog or stale promotional markup. No promotion is automatically assigned to all units.
- `effective_monthly_cost` deliberately remains null until unit eligibility, lease duration, mandatory fees, upfront nonrefundable costs, and the concession calculation are verified. Gift cards need a separate treatment from rent credits.
- Dates and availability text are source assertions. The collector does not turn "Now" or dates without a year into invented exact dates.
- A missing unit, a new HTTP failure, a filter change, or a paginated response never means "leased." No disappearance, vacancy, or occupancy estimates are generated.
- `advertisement_changed` is a review candidate, not a confirmed rent change. The website's default move-in date or lease selection may have changed. Every comparison is currently labeled `context_unverified`.
- Initial coverage at 4th West is biased by page ordering: the observed first page contained studios. Partial captures must not be treated as a property-wide rent distribution.

For a future verified effective-cost calculation, keep the components explicit:

```text
(base rent × lease months + fixed monthly fees × lease months
 + mandatory nonrefundable upfront charges − eligible rent credits) / lease months
```

Refundable deposits are cash needed at move-in, not automatically rent expenses. Do not convert "weeks free" to a dollar credit without the property's calculation rule. A complete model can display both cash-flow timing and the lease-wide average.

## Automation handoff

`run-daily.ps1` is a ready-to-invoke Windows wrapper. It collects, exports, and returns a nonzero status if any source needs attention. **No scheduled task has been registered.** A permanent host/time and archive backup destination are the remaining operational choices.

Suggested starting cadence: once daily at a consistent time. It is enough for this pilot and limits source load. Task Scheduler's program can be `powershell.exe`, with arguments adapted to the actual Python executable:

```text
-NoProfile -WindowStyle Hidden -File "D:\projects\github\deevis\astro_website\scripts\rent-tracker\run-daily.ps1" -PythonExe "C:\path\to\python.exe"
```

Use a persistent `--data-dir`/`-DataDir`; an ephemeral runner that discards its disk will lose history. Run under an account that can write that directory. Configure the scheduler to skip overlapping instances and capture stdout/stderr. A sleeping/offline machine creates a collection gap; do not backfill that gap with today's prices.

Exit codes: `0` completed (without `--strict`, gaps are still possible); `2` completed with sources needing attention under `--strict`; `1` command/storage/configuration failure. The wrapper exports after code `2` and preserves it for the scheduler. On Linux, invoke the same Python CLI from cron/systemd with a persistent data directory; no Windows dependency exists in the collector.

## Replay and extension

Saved HTML can be re-parsed without requests. Use a separate scratch archive so development does not duplicate the live history. Supply the original capture timestamp, not the reprocessing time:

The storage layer rejects mixing live collection and replay runs in one archive; exported rows also state their collection mode.

```powershell
python scripts/rent-tracker/track.py replay --property liberty-blvd --source inventory --html saved.html --observed-at 2026-09-28T04:29:42Z --data-dir tmp/rent-replay
```

The timestamp above is a syntax example, not a claimed observation. To replay archived `.gz` evidence, decompress it first and obtain the original timestamp from its capture record.

To add a property, verify the official source, assign a stable property ID, choose a reviewed adapter, and test a saved response. Record `restriction_status` and `housing_type` when established; absence means unknown. Geography and product mix must be expanded deliberately, rather than simply collecting whichever sites are easiest.

The next implementation priorities are full pagination at 4th West, RentCafe per-unit detail pages, and a fixed lease-term/move-in quote cohort. A browser capture transport can later be added for permitted JavaScript-only pages; it should feed the same extraction/storage layer and retain provenance. It is not an implemented fallback, and blocked sites currently remain explicit gaps.
