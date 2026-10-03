# Forecast accuracy article

A normal MDX entry in the existing Astro article collection. The shared layout, listing, author, date, tags and card follow the site's existing conventions. Only article-specific files are added; shared layouts, dependencies and configuration remain unchanged.

- Article: /articles/a-nationwide-dive-into-forecasting-accuracy
- Supporting assets: public/articles/forecast-accuracy/
- Component: src/components/forecast-accuracy/StudyEmbed.astro
- Banner and article card: public/images/articles/forecast-accuracy-banner.webp (generated editorial illustration; prompt in banner-prompt.md)

## Data boundary

All 70 retained stations have complete daily aggregate summaries and coverage. Salt Lake City #80 remains excluded as the duplicate of #1. Nationwide rankings include the 68 eligible histories; the explorer also includes histories too short for those rankings.

No original forecast temperatures, hourly comparison records, prediction/reference IDs, source forecast bundles or per-reading audit logs are distributed. The importer also strips embedded source-record examples from the nationwide report. Quality classifications and counts remain, so the quality controls still work.

The day inspector computes daily mean absolute/signed/RMS differences and counts across six leads using the already loaded summaries. It never fetches original records. Other charts retain their original calculations and use all available summary dates.

Current snapshot: through September 19, 2026; approximately 14.5 MB of article assets. Stations load on demand. JSON.gz compression is lossless and requires no special server headers; current browsers decompress the files directly.

## Local development and build

Use the project's existing npm run dev or npm run build commands. All generated assets are included; an ordinary Astro build needs no source database, sibling project or additional dependencies. The chart documents isolate their CSS and runtime from other articles.

## Refresh from the originating study

Refresh and validate forecast-analysis using its own documentation first. From astro_website:

    node scripts/forecast-accuracy/import.mjs ../forecast-analysis
    node --test scripts/forecast-accuracy/snapshot.test.mjs
    npm run build

The importer uses the standalone study's installed esbuild and chart dependencies. It reads only station summaries, nationwide reports, map summaries, aggregate CSVs and chart source. It never reads monthly pair exports or per-reading audit files, and never connects to the database.

aggregate-policy.mjs enforces the published data boundary. Daily and coverage field names are allowlisted, and recursive validation rejects individual-record fields. Raw example sections in the nationwide report are excluded. If the source schema changes, review the policy before rebuilding.

After a successful import, obsolete files are deleted only within public/articles/forecast-accuracy/. This removes the previous edition's raw files as well as their links. The resolved output path is checked before pruning. The original study and other article assets are untouched. The normal Astro build cleans and regenerates dist, so obsolete raw assets do not survive into deployment output.

snapshot.json records station IDs, aggregate counts, provenance, file hashes and an explicit individual_forecast_records_included: false flag. It contains no credentials or local source paths.

Update the article's dates and numerical examples, the embed caption and this snapshot note when importing a newer release. Nothing in these commands deploys the site.

## Verification

The eight snapshot tests check inventory completeness, absence of original forecast fields and stale payloads, hashes, all 70 stations' daily and coverage values against their source summaries, unchanged nationwide metrics, export rejection of nested raw data, day-inspector weighting/quality/cohort behavior, local links and gzip loading.

Check both public/articles/forecast-accuracy and dist/articles/forecast-accuracy before publishing. Neither may contain monthly pairs, raw audits, source-record examples or unmanifested files. Charts expose aggregate counts and differences only.

Browser checks should cover an additional station such as Miami, station comparison, year/lead/quality controls, seasonal grids, daily aggregates, map-to-explorer links and summary downloads.

## Latest verification

The summaries-only build completed successfully (93 Astro pages), and all eight snapshot tests passed. Both public and dist contain the same 88 manifested files for 70 stations, with matching hashes and no leftover raw payloads. The prior monthly-pair, raw-audit and extreme-input URLs return HTTP 404; station summary URLs return 200.

Browser checks confirmed 70 station options, Miami/Bismarck comparison, seasonal selectors, summary downloads, the daily aggregate inspector, Hartford's shorter history and map-to-explorer links for additional stations. A transient MutationObserver console error was observed during browser reloads; it did not block these interactions. Existing shared site files were left untouched. No deployment was performed.
