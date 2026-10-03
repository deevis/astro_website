# What keeps the lights on during the hardest hours?

A working, standard-library Python collector for EIA-930 hourly grid data, with a Utah-focused starting point and seven comparison areas. This is a research archive and analysis scaffold; it is separate from the apartment tracker and the published Astro site.

The collector downloads EIA's public six-month CSV files. No API key, account, browser automation, or Python package installation is required. Python 3.10+ is supported; the pilot used Python 3.12.

## Run it

From the repository root, in PowerShell:

```powershell
python scripts/grid-tracker/track.py list
python scripts/grid-tracker/track.py collect
python scripts/grid-tracker/track.py export
python scripts/grid-tracker/track.py report --ba PACE
python scripts/grid-tracker/tests/test_tracker.py
```

The default collection/export/report window is the preceding 45 UTC days, through today's UTC midnight exclusive. Recent hours can be missing or contain forecasts only. A successful download does not mean complete reporting; check coverage in the report or export manifest.

Reproduce the initial recent-history window:

```powershell
python scripts/grid-tracker/track.py collect --start 2026-07-02 --end 2026-09-28
python scripts/grid-tracker/track.py export --start 2026-07-02 --end 2026-09-28
python scripts/grid-tracker/track.py report --ba PACE --start 2026-07-02 --end 2026-09-28
```

Historical event backfill uses the same mechanism. For example, to examine the September 2022 Western heat wave:

```powershell
python scripts/grid-tracker/track.py collect --regions PACE,CISO --start 2022-09-04 --end 2022-09-10
python scripts/grid-tracker/track.py report --ba CISO --start 2022-09-04 --end 2022-09-10
```

These are **UTC hour-ending windows**, not local calendar days. Backfills do not erase other periods. Files are partitioned by local source data date, so a request beginning January 1 or July 1 also reads the preceding half-year file. An unavailable partition causes an explicit failure. Older BA codes can be supplied with `--regions`; the registry does not alias changed boundaries.

Equivalent npm shortcuts are `grid:list`, `grid:collect`, `grid:report`, `grid:export`, and `test:grid`. Python commands work independently of the Node toolchain.

## What is stored

Default output directory: `data/grid-tracker/`, ignored by Git and outside public site assets. Use `--data-dir PATH` to relocate it. Back up this directory if the historical evidence matters.

| Path | Contents |
| --- | --- |
| `grid.sqlite3` | Collection runs, fetch provenance, every changed row, withdrawals, and current row pointers |
| `raw/<sha256>.csv.gz` | Exact downloaded CSV bytes, compressed; identical downloads share an archive |
| `cache/*.json` | Conditional HTTP request metadata |
| `exports/hourly-balance.csv` | Current reported demand, forecast, generation, interchange, fuel JSON, residuals, and source hashes |
| `exports/hourly-interchange.csv` | Directional exchange for each selected reporter and all its reported counterparties |
| `exports/manifest.json` | Export window, counts, and per-area coverage |
| `exports/PACE-report.json` | Ranked candidate hours, fuel composition, preceding-hour changes, and counterparty flows |

Exports are regenerated for the requested window and overwrite those export filenames. The database and raw evidence retain history. Copy an export into an article-specific snapshot before using it in a publication. `pilot-summary.json` is a small, versionable record of the initial run, not the entire dataset.

`fuel_mw` is a JSON object embedded in CSV. Its keys are EIA's exact reported category labels. It deliberately does not merge older solar/wind labels with newer integrated-storage categories. Blank cells remain null; numerical zero and negative storage values retain their meanings. Raw row JSON also retains adjusted and imputed columns, but the current analysis uses reported values exclusively.

## Analysis and quality checks

The report ranks three descriptive candidates: highest demand, highest positive net imports, and largest one-hour demand increases. It includes supply changes from the immediately preceding hour only when both hours pass the accounting check. It does not bridge gaps.

In the source convention:

```text
net imports = -total interchange
balance residual = demand - net generation + total interchange
fuel residual = net generation - sum(nonmissing reported fuel components)
```

Ranking eligibility requires positive demand, nonmissing demand/generation/interchange, and an absolute balance residual no larger than `max(5 MW, 1% of demand)`. A reported balance series that differs from its available EIA-adjusted value by more than `max(5 MW, 1% of the absolute reported value)` also requires review and is excluded from candidate rankings. The adjusted values are shown separately as reference, never substituted into the reported calculation.

These are explicit research filters, not EIA rules or certificates of correct data. A large adjustment may reflect a genuine event that deserves investigation. Complete but excluded hours remain in the export and coverage counts; the report includes a separate review queue ordered by reported demand. A fuel subtotal is not proof of exhaustive fuel reporting, and a counterparty subtotal is not proof that every tie was reported. Inspect residuals and missing categories before making a chart.

MW labels are retained from EIA's hourly source columns. Do not confuse power with total energy over a multi-hour interval. Forecast error is observed demand minus the archived forecast; an old backfill is the forecast now in the file, not necessarily the original forecast available to operators at the time.

The archive distinguishes first observation, unchanged re-fetch, revision, and withdrawal. A withdrawn row is retained as a tombstone revision and omitted from current exports. Invalid numbers, conflicting duplicate keys, and missing required headers reject a whole source file transaction. An HTTP or parse failure leaves prior history intact and records a failed/partial run. Reports can therefore contain older retained observations after a failed refresh; consult `last_seen_at`, coverage, and collection status.

## Daily operation

```powershell
powershell.exe -NoProfile -File scripts/grid-tracker/run-daily.ps1
```

The wrapper collects the rolling window, exports it, and writes the PACE report. Exit `0` means the requested file operations succeeded; `2` means partial/failed collection with status details; `1` is a local command error. Exports after a collection failure may still contain preserved prior data and must not be described as a fresh successful collection.

For deployment, run once daily, for example at 09:15 America/Denver, using an absolute wrapper path and a stable Python executable. Disable overlapping scheduler runs; this starter assumes one writer. No scheduled task or Codex automation has been registered. The wrapper is ready for scheduler integration.

Conditional GETs reuse unchanged files. Changed half-year files are downloaded in full, even for short date windows. Requests are sequential, with a 90-second socket timeout and 256 MiB cap per data file. There are no automated retry storms. A daily rolling window captures recent revisions; periodically rerun a longer range (for example the preceding year) to incorporate older revisions into SQLite. Raw downloads already contain the full source file, but only the requested dates/areas are indexed.

## Extension points

- Add comparison BAs in `regions.json`; validate coverage and historical boundary changes first.
- Add operator emergency notices, reserve/availability measures, observed weather, and outage-event evidence before calling any candidate hour a reliability emergency.
- Add a separately named adjusted-data analysis mode if needed; never silently blend it with reported values.
- Build article charts from frozen exports: an event timeline, fuel/output changes, and an exchange diagram from the focus BA's reports. Do not sum both ends of a tie.

See [RESEARCH.md](RESEARCH.md) for source links, article questions, interpretation limits, and historical event candidates.
