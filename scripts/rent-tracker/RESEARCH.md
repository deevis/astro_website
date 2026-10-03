# Salt Lake Valley apartment pricing: research and collection pilot

Research date: September 27, 2026, America/Denver. Live test runs later that local evening have September 28 UTC timestamps. Search-engine excerpts were used for discovery, never inserted as historical observations.

Latest refresh: **October 1, 2026**, at approximately 02:02 America/Denver. See the dated update below and [refresh evidence](updates/2026-10-01.json). The pilot findings remain a record of the original visits.

Working article question: **When an apartment does not rent, how does its advertised deal change?**

The archive should ultimately distinguish base-rent changes, mandatory fees, concessions, quote terms, and time observed on the market. This first version creates the evidence trail and exposes the access and coverage problems before a trend is claimed.

## Findings that shape the collector

**4th West exposes more structure than its visible page suggests.** The [floorplan page](https://4thwest.com/floor-plans/) contains `SPACES.initialData`: unit IDs/numbers, floorplans, dates, base rent, displayed total, unit fees, and alternative lease-term prices. During reconnaissance the first page contained 8 of 36 source-reported units, with five pages indicated. Those eight were studios, making the pagination gap substantively important. Full pagination is not implemented yet.

Its [homepage](https://4thwest.com/) advertises selected-unit concessions with term and timing conditions. The collector keeps the promotion separate from the inventory rather than treating the headline as a discount on every unit.

**Liberty Blvd exposes floorplan ranges and linked unit-detail pages.** Its [floorplans](https://www.libertyblvd.com/floorplans) repeat some cards in dialogs. The adapter deduplicates those copies and preserves unpriced floorplans. The [homepage](https://www.libertyblvd.com/) supplies promotion text separately. The current adapter stops at floorplans; following unit-detail links is a next step.

**Quoted rent is not a uniform measure.** [Clover Creek](https://www.clovercreekapts.com/floorplans) labels total monthly leasing price, base rent, and term. [thePEARL](https://meetthepearl.com/apartments/) likewise exposes base and total monthly prices. Its disclosure says the total can include selected optional services and excludes some variable/upfront charges. Accordingly the collector does not automatically identify the entire base-to-total gap as mandatory fees.

**Concessions have eligibility and cash-flow rules.** [Current Apartments](https://www.currentaptsmurray.com/murray/current-apartments/conventional/) publishes dated move-in conditions and eligible lease terms. Archive the wording and dates; an offer that remains in the HTML after expiry is still only an observed advertisement, not a verified active discount.

**Access is variable.** Several RentCafe/Entrata pages returned HTTP 403 in one request and useful HTML in another. The implementation uses ordinary anonymous GETs, respects robots checks, and leaves denied/rate-limited sources as gaps. It does not change user identities or attempt to defeat a challenge.

## Initial source registry

These are community counts, not unit counts. All links are official property pages reviewed during research. "Floorplans" describes the intended data level; automated access and adapter validation are reported separately in the pilot results.

| Community | City | Initial source / collection level |
| --- | --- | --- |
| [4th West](https://4thwest.com/floor-plans/) | Salt Lake City | Unit JSON, initially partial; separate homepage promotions |
| [Liberty Blvd](https://www.libertyblvd.com/floorplans) | Salt Lake City | Floorplans; separate homepage promotions |
| [Gateway 505](https://www.gateway505.com/) | Salt Lake City | Promotions; inventory adapter pending |
| [Altitude on Fifth](https://www.altitudeonfifthapartments.com/) | Salt Lake City | Promotions; inventory adapter pending |
| [The Bonneville](https://www.the-bonneville.com/) | Salt Lake City | Promotions; availability-form adapter pending |
| [Current Apartments](https://www.currentaptsmurray.com/murray/current-apartments/conventional/) | Murray | Floorplans and conditional offers |
| [Clover Creek](https://www.clovercreekapts.com/floorplans) | Murray | Floorplans, explicitly labeled base/total prices |
| [Lofts at 7800](https://www.loftsat7800isyourhome.com/ut/midvale/floorplans) | Midvale | Floorplan ranges |
| [San Moritz](https://www.sanmoritzisyourhome.com/ut/midvale/floorplans) | Midvale | Floorplan ranges and dates |
| [Liberty Bend](https://www.libertybendapartments.com/floorplans) | Sandy | Apartments/townhomes; floorplans and homepage offers |
| [Parc West](https://www.parcwestisyourhome.com/ut/draper/floorplans) | Draper | Floorplan ranges and dates |
| [thePEARL](https://meetthepearl.com/apartments/) | South Jordan | SPACES floorplan cards; base/total prices and terms |
| [Sunset Ridge](https://www.sunsetridgeaptsutah.com/availableunits) | West Jordan | Individual-unit tables and dates |
| [Aspen Village](https://www.aspenvillageutah.com/floorplans) | West Valley City | Floorplans; site says income restrictions may apply |
| [Bridgeside Landing](https://www.bridgesideapartments.com/floorplans) | Taylorsville | Floorplan ranges and advertised counts |
| [45 Twelve Townhomes](https://www.45twelve.com/floorplans) | Millcreek | Townhome floorplans, a separate product category |

`properties.json` is the executable registry and holds source-specific implementation notes. It intentionally contains no manually seeded rent observations. `pilot-summary.json` records the final validation run's coverage and status without publishing raw source HTML.

## Pilot validation

Three live collection runs produced 120 historical observation rows representing **25 distinct unit listings and 45 distinct floorplans**. Some floorplans have no disclosed rent. These counts describe what the collector saw across the visits, not current market inventory.

The final full-cohort run attempted all 19 configured pages: 6 inventory parses, 4 promotion-page captures, 5 unavailable robots checks, and 4 HTTP failures. Earlier successful Sunset Ridge and Bridgeside observations remained in the archive when subsequent requests failed. This is a useful demonstration of why carrying old listings forward as freshly observed inventory would be misleading.

Validation passed 17 offline tests covering pricing distinctions, term/area ranges, conflicting duplicate cards, promotions, robots/backoff, history preservation, change detection, evidence deduplication, concurrency, and isolation of replay data. All 40 saved gzip evidence files matched their SHA-256 names. The final parser re-read all 12 successfully captured sources without record-count drift. JSON and CSV exports contained the same 120 rows. The Windows wrapper passed a syntax check; no scheduled task was installed.

Direct Python commands were tested. The npm alias could not be executed in the tool sandbox because Node was denied access while resolving its user-profile path; the Python collector and tests do not depend on npm. No Astro build was needed for these collection-only changes.

## October 1, 2026 refresh

The collector processed all 19 configured sources across the 16-community registry. It added **23 observations**: eight units at 4th West and 15 floorplans at thePEARL. The archive now contains **143 historical observation rows**. These include repeated observations of the same listings, not 143 distinct apartments.

Access coverage was lower than in the pilot: two inventory pages parsed, one promotion page was captured, ten pages returned HTTP 403, five sources had unavailable robots checks, and one source was skipped after its origin denied an earlier request. Liberty Blvd's inventory returned 403 and its promotion page was skipped under that rule. No current prices were inferred for those failed sources; older observations remain dated history.

All eight previously captured 4th West units were matched on the current partial first page. Four had changed advertisements compared with the September 28 UTC capture:

| 4th West unit | Previous displayed base rent | Current displayed base rent | Displayed lease months, before → after |
| --- | ---: | ---: | --- |
| 5088 | $1,482 | $1,468 | 12 → 13 |
| 3021 | $1,369 | $1,357 | 12 → 12 |
| 3078 | $1,397 | $1,385 | 12 → 12 |
| 3077 | $1,376 | $1,364 | 12 → 12 |

Unit 5088 illustrates the quote-context problem: its displayed $14 reduction also switches the displayed lease duration. Its separately advertised 12-month base quote changed from $1,482 to $1,469. Even that comparison does not hold the requested move-in date fixed. All four changes remain `context_unverified`, and this small studio-page sample does not establish a property-wide or valley-wide rent trend.

All 15 thePEARL floorplans matched the previous capture, with no changes in the tracked comparison fields. Its floorplan-level coverage remains separate from individual unit quotes.

The updated JSON and CSV exports agree on 143 rows. SQLite integrity and foreign-key checks passed, all 120 prior observations remain, and all 54 saved raw evidence files matched their SHA-256 filenames. The dated [refresh summary](updates/2026-10-01.json) preserves the run ID, before/after price details, capture timestamps, source URLs, hashes, and access gaps. The original pilot summary was retained.

## Sampling plan before publication

- Expand beyond the five downtown Salt Lake City communities. Add older buildings, small landlords, and additional west/south valley locations. The current sample emphasizes professionally managed, publicly advertised listings.
- Verify municipal boundaries and management/ownership from reliable records before using geographic or common-owner groupings analytically. Website postal addresses are not boundary evidence.
- Keep income-restricted, market-rate, townhome, furnished, and lease-term categories distinct. Do not infer unrestricted status merely because a website omits eligibility details.
- Preserve unit identities within a property. Names and floorplan labels may change; do not link unrelated units using rent or square footage alone.
- Require a coverage audit before calculating listing-removal rates. A missing scrape, failed parser, filtered page, pagination gap, or unavailable date creates uncertainty rather than a lease event.
- Publish coverage alongside every chart. Equal property weighting and paired-unit comparisons answer different questions from pooling every visible listing.

## Next technical milestones

1. **Complete the inventory at the two anchor properties.** Follow the public pagination mechanism at 4th West and linked floorplan-to-unit detail pages at Liberty Blvd. Validate advertised totals and terminate bounded pagination only when completeness is demonstrated. Preserve partial captures when a later page fails.
2. **Normalize quote context.** Collect explicit 12-month quotes for fixed calendar move-in cohorts. Keep default-site prices separate. Moving the target move-in date every day changes the product being priced.
3. **Review promotion eligibility and fees.** Add structured, source-linked annotations for unit applicability, deadlines, lease terms, amount, timing, refundability, and fee frequency. Do not automatically turn ambiguous copy into savings.
4. **Operate daily on a durable host.** Use `run-daily.ps1` or the Python CLI, retain backups, and surface actionable failures. Scheduling is prepared but has not been installed.
5. **Build the article from enough history.** Initial snapshots can illustrate pricing structure. Changes over several months can support descriptive timelines; annual seasonality needs longer coverage or independent historical data.

## Proposed article and interactive views

- **The advertised price and the price over a lease:** paired base/total/verified effective-price views, with unknown fees shown explicitly.
- **A unit's listing history:** rent, terms, concessions, and availability as observed, with gaps visible. First observed is not the original listing date.
- **How deals evolve:** whether observed discounts deepen with listing age, comparing similar units/terms and showing the bias from listings already present when collection starts.
- **Neighborhood and property comparisons:** stratified by beds, size, property type, restriction status, and sampling coverage.
- **What a listing disappearance can tell us:** an explanation of why removal is not proof of a signed lease or a vacancy estimate.

No article or public dashboard is published in this scaffold. There is not yet enough longitudinal evidence to claim falling rents, rising vacancies, coordinated pricing, or the effectiveness of a particular concession.
