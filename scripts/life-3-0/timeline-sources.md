# Timeline chart source notes

Reviewed September 30, 2026. These visuals distinguish historical results, survey beliefs, and benchmark estimates.

## Forecasts beside later results

- Baseline: Grace et al., *When Will AI Exceed Human Performance? Evidence from AI Experts*, first submitted May 24, 2017; survey conducted in 2016. [Table S5](https://arxiv.org/html/1705.08807v3) reports aggregate 50% horizons of 6 years for StarCraft and 9.6 years for high-school essays. Calendar labels add those horizons to 2016 and round to a whole year: 2022 and 2026. They are not individual-response medians.
- [AlphaStar report, October 30, 2019](https://deepmind.google/blog/alphastar-grandmaster-level-in-starcraft-ii-using-multi-agent-reinforcement-learning/): Grandmaster level, above 99.8% of ranked players. The survey's full target required beating the best players using screen video. AlphaStar's structured interface and ranking do not establish that entire target. The chart says “related result.”
- [Herbold et al., October 30, 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10616290/): teachers rated generated argumentative essays above the comparison student essays. The original forecast concerned history essays, high grades, and plagiarism checks. The caption identifies that mismatch; the chart is not a scorecard of completed milestones.

## Historical task horizons

- [METR's March 2025 explanation](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/) describes a roughly seven-month doubling time over its historical trend.
- Values in `src/data/life-3-0-horizons.json` were copied from [METR v1.0 YAML](https://metr.org/assets/benchmark_results_1_0.yaml), retrieved September 30, 2026. The public data can be revised; the article uses a fixed local snapshot, not a live fetch.
- Six selected model rows, ending February 2025, show the historical progression. This chart deliberately does not claim to be a September 2026 model leaderboard.
- `estimate`, `ci_low`, and `ci_high` are in human-expert minutes at a fitted 50% success threshold; whiskers show 95% confidence intervals. Dates are METR's assigned model-family dates, not necessarily exact endpoint launch dates.
- Axis mapping: `log(minutes / (0.5 / 60)) / log(120 / (0.5 / 60))`. Its domain is 0.5 seconds to 120 minutes. Every displayed interval lies inside this domain. The endpoint ratio is 55.258445 / 0.053778 = approximately 1,027.5, displayed as ~1,000×.

## Forecast revisions

- [Grace et al., *Thousands of AI Authors on the Future of AI*, §3.2.1](https://arxiv.org/html/2401.02843v1) gives a harmonized comparison: 2016 survey → 2061; 2022 survey → 2060; 2023 survey → 2047. These are aggregate 50% probability years for high-level machine intelligence.
- The paper notes that 2022 had originally been reported as 2059; code and data-cleaning changes shifted that estimate to 2060. The chart follows the paper's harmonized series consistently.
- Differences: 2061 − 2047 = 14 calendar years; 2061 − 2060 = 1 year; 2060 − 2047 = 13 years. These are changes in forecasts, not measured acceleration factors, fixed deadlines, or predictions by Max Tegmark. Sample composition changed across surveys.
