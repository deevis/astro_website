# Forecast agreement: methods and data scope

This article distributes aggregate statistics for every retained station. Individual forecast temperatures, hourly comparison pairs, prediction/reference IDs, forecast bundles and reading-level audit logs are not included.

The reference is the stored near-term (zero-hour) forecast, not a sensor measurement. Every target hour contributes at most one comparison at each nominal lead of 24, 48, 72, 96, 120 or 144 hours. Matching selects the nearest saved lead within ±4 hours, preferring exact matches and then the older forecast on ties. Missing references remain missing.

## Summaries

Station files retain sufficient statistics grouped by local date, lead, quality classification and common-hour cohort. They include comparison counts, signed/absolute/squared difference totals, direction counts, within-2°F/within-5°F counts, lead offsets and calendar-hour coverage. Means are computed from totals and counts; monthly or annual cells are not averaged without their weights.

The day inspector shows daily means across the six leads. Its quality and common-hour settings follow the main controls. It never loads individual temperature values.

## Nationwide comparison

The completed-year peer comparison uses 33 shared months from 2023–2025 and 68 eligible stations. Station rankings require valid comparisons at all six leads at the same target hour. Each month receives equal weight. State values then average contributing stations equally.

The map additionally offers available-period and matched-year-to-date views through the snapshot cutoff. Those views use available pairs at the selected lead. Matched YTD holds calendar coverage and station membership fixed across years at each lead. Some selections have no eligible stations; missing values are not replaced by zero.

## Quality and uncertainty

The default quality view excludes inputs flagged by broad bounds, sharp adjacent-reference jumps, two-standard-deviation site/month/local-hour screening or documented events. Alternate views use aggregate statistics including flagged inputs. Flags can remove genuine extremes. Audit counts are retained; individual audit records remain in the originating analysis project.

Explorer intervals use 1,000 fixed calendar-block bootstrap resamples, requiring at least 30 sampled dates and eight occupied blocks. Nationwide intervals use paired year-month resampling within calendar-month strata. These exploratory intervals do not remove sampling bias or correct for multiple comparisons.

Station outlier labels use modified Z scores with a 3.5 threshold, plus a broader ordinary-Z watchlist at 2. They are investigation flags, not proof of bad data.

## Coverage and provenance

Coverage is the fraction of tracked calendar hours with a near-term forecast, including gaps within a station's interval. It is not an accuracy percentage. First and last months may be partial. Local timezones determine calendar dates.

The catalog and snapshot manifest list the source release, date range, station IDs and aggregate counts. Duplicate Salt Lake City #80 is excluded; #1 is retained. All 70 remaining histories are available in the explorer, including the two that do not qualify for peer rankings.

Source: National Weather Service hourly responses archived by Trackit. The originating project retains source records; the article contains only derived summary data.
