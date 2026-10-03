# Salt Lake County jail: article data

Article edition: September 24, 2026. Source archive version: `20260919T200857-fc8ee5cb`.

The underlying archive contains 247 manually collected county jail roster snapshots from June 3, 2023 through September 18, 2026. This static export contains the 220 snapshots with directly observed Citizen and COB fields, ending February 24, 2026. The next collected roster, March 1, lacks both fields. No historical labels are carried forward and no demographic attributes are inferred from names.

## What is included

`data.json` contains aggregate counts only. It has no names, booking identifiers, individual-level records, or raw scrape payloads. It can be served as a static file; no database or Python server is needed by the published article.

- `version`, `edition`: source build and article edition.
- `runs`: ordered roster dates, `total` observed bookings, and `alert` for a known collection-coverage concern. There are two alerted runs in this demographic window. An unflagged run is not certified complete.
- `fields.citizen` and `fields.cob`: category definitions and a count matrix. Row `i` corresponds to `runs[i]`; column `j` corresponds to `categories[j]`. Each row sums to that roster's total. There are 146 citizenship and 191 COB categories across the archive.
- Each category has a stable `key`, a display `label`, and a `kind`: recorded, unknown, ambiguous, or missing. These categories retain source-label distinctions; they do not certify a person's citizenship, birthplace or immigration status. COB contains state and country values. Non-country citizenship values are preserved as ambiguous instead of silently assigned to a country.
- `article.months`: screened monthly means, including an explicit null row for April 2025, when no scrapes were collected. `runs` gives the number of retained snapshots in each month.
- `article.periods`: Q4 summaries for 2023, 2024 and 2025.
- `article.charges`: Q4 shares and average counts for recorded code 76-8-305, with shares for its old and new description. Each combined-code count counts a booking once; description groups can overlap.
- `article.coverage`: the observed field-removal boundary and counts of later field appearances.

## Calculation and interaction

A roster share is `100 × matching bookings / all observed bookings`, including missing, unknown and ambiguous labels in the denominator. The label explorer defaults to excluding known coverage-alert runs. Users can include them; they are shown in amber.

Selecting excluded labels removes their counts from the denominator as well as the display. The panel separately reports full, excluded and remaining booking totals. A zero remaining denominator gives an undefined share, never a zero-percent claim. Count mode shows matching observed bookings. Focus labels that have been excluded cannot be selected until restored. Exclusions are independent for Citizen and COB.

For each headline period, first calculate the mean roster count or share within each month, then average October, November and December equally. Q4 2023 uses 27 screened snapshots; Q4 2025 uses 14. This is an average of snapshot shares, not the ratio of pooled counts, a count of admissions, or a count of distinct people. The monthly chart and the snapshot explorer use different levels of aggregation by design. Headline results stay fixed when readers explore subsets.

The monthly plot breaks at missing months. The snapshot plot also breaks connections across gaps longer than 35 days; a connecting line elsewhere does not assert daily observation. Axes begin at zero. The snapshot axis rescales with the selection; the overview plots use explicitly labelled 0–3% and 0–100% axes. Charge bars share a 0–10% scale.

The distinct-booking check quoted in the prose (25 and 77 Venezuela-labelled booking IDs in the screened Q4 periods) was computed from the local source database. Those identifiers are intentionally absent from this aggregate publication, so that check cannot be independently recomputed from this export alone. The export also does not include per-roster charge details for recomputing the charge summaries.

## Limits and provenance

The source is the Salt Lake County Sheriff's public inmate lookup. Collection was manual and recently approximately weekly. Some stays fall between collection dates; repeated observations of one booking are correlated. Charges are not convictions. County jail occupancy does not directly measure Salt Lake City crime rates, population prevalence, immigration status or the causal effects of city policy. The article reports descriptive comparisons, not a significance test or a causal estimate.

The local database was opened read-only for export. Its SHA-256 before and after export was `395b54a8ced8caa36ee1168320dd6a3d737138486d84820134c4e2f31e89739c`. The original archive and existing scraper and loader are separate from this article.

Context sources were reviewed September 20, 2026. The official roster privacy notice and March 24 council minutes explain the county's stated rationale; they do not prove political motive or identify the approver of each removed field. Source links and the distinction between official records, reporting and social discussion appear in the article.

The accompanying `scripts/salt-lake-jail.test.mjs` checks aggregation, denominators, exclusions, missing periods and plotting edge cases against this export. Run it from the website project with `node --test scripts/salt-lake-jail.test.mjs`.
