# Research brief: the hours when electricity supply has to adapt

Research date: September 28, 2026. Working question: **When demand rises or a source of supply falls, what changes to keep electricity flowing?**

Latest refresh: **October 1, 2026**, at approximately 02:02 America/Denver. See the dated update below and [refresh evidence](updates/2026-10-01.json). Initial findings are retained with their original data vintage.

The strongest article follows specific hours: demand climbs, the mix of generation changes, and neighboring operating areas exchange power. Start with PacifiCorp East (PACE), then compare systems with different resource mixes. Keep the observed accounting separate from claims about what would have happened without a particular resource.

## Verified sources and scope

| Source | What it contributes | Collector status |
| --- | --- | --- |
| [EIA Hourly Electric Grid Monitor](https://www.eia.gov/electricity/gridmonitor/about) | National entry point for balancing-area operations | Public bulk CSV feed connected |
| [EIA bulk-file index](https://www.eia.gov/electricity/gridmonitor/sixMonthFiles/EIA930_File_List_Meta.csv) | Actual filenames and source update metadata | Archived each collection |
| [Current balance file](https://www.eia.gov/electricity/gridmonitor/sixMonthFiles/EIA930_BALANCE_2026_Jul_Dec.csv) | Demand, forecast, generation, fuel categories, total interchange | Implemented |
| [Current interchange file](https://www.eia.gov/electricity/gridmonitor/sixMonthFiles/EIA930_INTERCHANGE_2026_Jul_Dec.csv) | Each reporting area's exchanges with individual counterparties | Implemented |
| [CAISO emergency notification history](https://www.caiso.com/library/emergency-notification-history) | Independently identified stress events and peak-load history | Research source; no automatic notice parser yet |
| [FERC/NERC February 2021 inquiry](https://www.ferc.gov/news-events/news/final-report-february-2021-freeze-underscores-winterization-recommendations) | Evidence about actual outages and the winter event | Historical case-study source |

EIA documents demand/total-generation/interchange history from July 2015 and fuel detail from July 2018. Historical files let us begin analyzing past events immediately. [EIA's grid-monitor launch](https://www.eia.gov/todayinenergy/detail.php?id=40993)

Publication lags differ by series; bilateral exchanges generally arrive later than demand. EIA also revises anomalous historical values. The collector records the date it obtained each source and exposes incomplete coverage instead of converting gaps into zero. Demand excludes electricity served directly by distributed generation, and the visible generating fleet is limited by operator reporting. [EIA's data-use explanation](https://www.eia.gov/todayinenergy/detail.php?id=43295)

The reporting instructions define UTC hour-ending timestamps and an interchange sign convention in which outward flows are positive. Storage can have negative output while charging. The implementation retains those signs and does not add charging as a second load. [EIA-930 instructions](https://www.eia.gov/survey/form/eia_930/instructions.pdf)

## Utah is a starting point, not the reporting boundary

PACE is an operating area, not all electricity consumed or produced inside Utah. PacifiCorp operates two balancing areas; its retail business also spans multiple states. Geography, ownership, market membership, and balancing responsibility are different concepts. [PacifiCorp's description](https://www.pacificorp.com/about/newsroom/news-releases/extended-day-ahead-market-live.html)

The first registry contains PACE, PACW, IPCO, NEVP, SWPW, CISO, BPAT, and ERCO. The archive keeps all reported exchange counterparties of each selected area, including counterparties outside that list. Texas is a separate comparison case, not added into a Western total.

In the July–September 2026 source inspected during setup, PACE reports counterparties AZPS, BHBA, IPCO, LDWP, NEVP, NWMT, and SWPW. This is an observation about this source period, not a permanent network map. A flow names the adjacent area, not the original power plant or fuel behind imported electricity.

There is a material 2026 boundary break: SPP's transition plan consolidates WACM and WAUW into SWPW and transfers other assets/load. SPP confirms its Western expansion went live April 1. The registry keeps a boundary note rather than renaming old WACM rows to SWPW. [SPP transition plan](https://spp.org/documents/75997/2026%20rtoe%20swpw%20transition%20plan%20%E2%80%93%20market%20participant.pdf), [SPP Western services](https://www.spp.org/western-services/)

## The analysis to build

1. **What carries the busiest hours?** Compare the highest-demand hours with the rest of the same season. Show absolute output and its share of demand; present exports separately. An annual generation share cannot answer this question.
2. **Who responds as conditions change?** Follow consecutive hours through an evening or weather event. Measure changes in each reported fuel and in net imports. These are observed changes, not econometric estimates of marginal generation.
3. **How much do neighbors matter?** Show PACE's reported incoming and outgoing ties at an event hour, with a reconciliation to total interchange. Compare the neighbors' conditions only where their own balance series has been collected. Do not sum reciprocal reports as separate energy.
4. **Are the hardest hours necessarily the biggest peaks?** Compare demand peaks, fast ramps, high imports, and independently documented emergencies. A moderate-demand hour can be difficult when plants or transmission are unavailable. Served demand during outages can understate what customers wanted to use.
5. **How much of the apparent story is a data revision?** Compare successive snapshots, report missing fuel categories and accounting residuals, and mark changes to operating-area boundaries or source categories.

The implemented report supplies candidates for the first three questions. It does not yet estimate available reserves, marginal fuel, avoided blackouts, household outage exposure, or the causal impact of market expansion. High imports alone are not evidence of danger. Fuel names and accounting totals alone cannot establish which technology "saved" a grid.

## Historical case studies worth backfilling

| Case | Suggested collection window (UTC; end exclusive) | Evidence and use |
| --- | --- | --- |
| September 2022 Western heat wave | PACE/CISO, September 4–10 | CAISO's report analyzes September 5–8 and identifies September 6 as its highest emergency-alert day. Compare event hours and neighboring flows. [CAISO report](https://www.caiso.com/documents/summermarketperformancereportforseptember2022.pdf) |
| February 2021 freeze | ERCO/SWPP/MISO, February 8–22 | Use the joint inquiry to interpret failures and involuntary demand reductions; a generation chart alone is insufficient. [FERC/NERC report](https://ferc.gov/sites/default/files/2021-11/cold%20weather%20report_%20november%202021.pdf) |

These are research candidates, not claims that the first bootstrap has collected both events. The command-line collector supports their date ranges; BA availability and reporting categories must be checked in each exported manifest.

## Article treatment

Working title: **What actually keeps the lights on during the hardest hours?**

Open on a locally relevant hour. Show what demand was, what generators produced, and the signed balance of imports. Zoom out to an event timeline, then compare a few hours when the mix changed in different ways. Include a short methodology panel explaining geography, missing data, source vintage, and the distinction between high demand and an emergency. Freeze the source hashes used for every published result.

The next analytical layer should pair observed temperatures with independently documented operator events. Use observed weather, not forecast snapshots from the separate forecast-accuracy project. An explanatory article can then distinguish heat, cold, sunset ramps, outages, and ordinary trading without assigning every change to a preferred energy narrative.

## Initial collection and an early lead

Two successful live runs collected the window July 2 through September 28, 2026, in UTC hour-ending time, with the final date exclusive. The archive contains **16,896 balance rows and 132,583 directional interchange rows** across eight areas. The second run used conditional HTTP responses and created no additional observation versions. Three unique raw archives passed SHA-256 verification; SQLite integrity checks and 21 offline tests passed. [Saved pilot results](pilot-summary.json)

PACE has 2,095 complete reported balances out of 2,112 requested hours; 2,094 pass the starter's review filters. Recent forecast-only rows account for its 17 incomplete hours. These are initial candidates from one data vintage, not established reliability emergencies.

| PACE candidate | UTC hour ending | Source local hour label | Demand | Net generation | Net imports |
| --- | --- | --- | ---: | ---: | ---: |
| Highest eligible demand | July 20, 2026, 23:00 UTC | July 20, 5 p.m. | 10,173 MW | 9,031 MW | 1,142 MW |
| Highest eligible net imports | July 3, 2026, 00:00 UTC | July 2, 6 p.m. | 8,317 MW | 6,151 MW | 2,166 MW |

At the second hour, net imports equal **26.04% of reported demand**. Compared with the immediately preceding hour, demand rose 310 MW, net generation fell 164 MW, and net imports rose 474 MW. This is a concrete illustration of the regional balance changing as local demand and production move in opposite directions. It does not establish what would have happened without those imports. Both total interchange and PACE's reported counterparty sum reconcile for this example.

There are consequential source-quality findings. A September 25 PACE row reports demand of 36,258 MW and wind of 30,496 MW; its accounting totals reconcile, yet EIA's adjusted demand is 6,379 MW and adjusted wind is 1,587 MW. The starter retains the raw values and queues that hour for review rather than presenting it as the season's peak. It does not silently adopt the adjusted values as truth.

CISO has 2,008 of 2,096 complete reported hours failing the balance-residual screen in this download. NEVP also has many flagged hours. Those findings require investigation before a comparative fuel-share chart or claim about shortages. A missing category, reporting problem, or definition change is not evidence that the corresponding generators actually shut down. The manifest exposes these differences in usable coverage.

See [README.md](README.md) for the working commands, archival schema, quality filters, daily runner, and remaining operational setup. No recurring scheduler task is active yet.

## October 1, 2026 refresh

The third collection run successfully refreshed all eight configured areas for UTC hour endings from July 2 through October 1, with October 1 exclusive. Current exports now contain **17,472 balance rows** and **137,191 directional interchange rows**. They include forecast-only rows where actual measurements have not arrived.

| Dataset | New hourly identities | Revisions to existing identities | Current exported rows |
| --- | ---: | ---: | ---: |
| Balance | 576 | 563 | 17,472 |
| Directional interchange | 4,608 | 7 | 137,191 |

The 5,184 new identities and 570 revisions are separate: a revision changes what the source says about an existing hour/tie. The archive retains **155,233 observation versions**, including all 149,479 versions present before this refresh. No source rows were withdrawn in this run.

The suspicious September 25, 18:00 UTC PACE observation has now been revised by the source: reported demand changed from **36,258 to 7,046 MW**, and reported wind changed from **30,496 to 1,300 MW**. This is a data revision, not a fall in demand between two different hours. Both versions and their source hashes remain available. The original pilot's highest eligible demand and highest eligible net-import examples are unchanged.

A different PACE hour, September 29 at 22:00 UTC, now requires review: reported demand is 35,979 MW while the EIA-adjusted reference is 6,612 MW. It is excluded from candidate rankings under the existing rule; adjusted values are not substituted into the reported series.

Publication lag remains visible. PACE's latest complete balance is the hour ending **September 30 at 06:00 UTC**; its latest counterparty-flow hour is **September 29 at 06:00 UTC**. PACE has 2,167 complete balances out of 2,184 requested hours, and 2,166 pass the ranking filters. The collection date does not imply that October 1 operating data are available.

CISO still has substantial reporting/accounting issues: 2,066 of its 2,168 complete reported hours fail the balance screen. Regional comparisons must account for this uneven usable coverage.

Both CSV counts match the database. SQLite integrity and foreign-key checks passed, and all six unique archived source files passed SHA-256 verification. The [dated refresh summary](updates/2026-10-01.json) records the new/revised counts, source provenance, per-area coverage, and PACE revision history. Previous reports were snapshotted locally before regeneration; the original pilot summary remains unchanged.
