# Retirement planner review

Reviewed and repaired September 12–13, 2026. Changes are local and have not been committed or deployed.

## Bitcoin projections and ATH conversions

- Each Bitcoin holding now follows the selected model from its own entered spot price. Contributions buy units, withdrawals reduce units and cost basis, and the first projected year receives a full year of growth.
- Fixed-return Bitcoin honors Assumptions in both deterministic and Monte Carlo projections. Other model curves remain exploratory formulas; the UI previews their 1-, 5- and 10-year prices and explains the separate Monte Carlo model.
- ATH harvesting accepts equality and a configurable pullback (default 5%). It preserves the historical high through sales, respects the annual sale cap and exact cash-buffer target, and can run before Social Security or throughout retirement.
- Accounts lacking a Bitcoin spot price are not compared with a BTC/USD historical high. Crypto highs track market returns independently of deposits and sales.
- Projection rows expose Bitcoin price, net harvest proceeds and the reason for each decision.
- Browser reproduction: 3 BTC at $120,000, historical ATH $126,000, 5% tolerance, one year of $12,000 spending, 100% annual cap, fixed 0% return. The first year sells $12,000, reports 4.8% below ATH, and repeats while eligible. At the pre-SS window boundary, harvesting stops.

## Other corrections

- Federal taxes are funded from income or account withdrawals, including tax gross-up. Estimated sale withholding is reconciled to the annual tax estimate. Brokerage gains from conversion-tax funding are included.
- Capital gains tax uses marginal bands instead of a tax cliff. Collectibles use a 28% cap, and unused standard deduction is applied.
- Federal brackets, deductions and Medicare income thresholds share verified 2026 constants. Social Security taxable benefits increase gradually across the provisional-income thresholds.
- RMDs use prior-year balances and preserve reinvested surplus. Roth transfers retain the original owner and custom schedules cannot bypass exhausted conversion headroom.
- Both spouses' salary stop dates and explicitly continuing pensions work independently. The projection horizon covers a younger spouse's remaining lifetime.
- SSA wage bases and wage indexes were corrected, pre-1990 wage bases filled in, 2026 bend points adopted, and currency-formatted earnings paste plus duplicate-year handling repaired.
- Monte Carlo, optimizer and RAMP cancellation settle cleanly and suppress stale results. Optimizer comparisons use matched random paths. Risk percentages use all retirement years in their denominator.
- Failed saves are reported; invalid backups are rejected before replacing a valid plan, and corrupt stored data is preserved for recovery. Actual save timestamps and unchanged-plan detection replace misleading autosave updates.

## UX

Mobile section navigation, full-size planner controls, visible focus, keyboard-contained dialogs, Escape dismissal and restored focus, scrollable editors, draft cancellation without phantom assets, live-price timeouts and stale-response guards, editable conversion schedules, clearer methodology, and correctly aligned projection table headings, and combined timeline labels for milestones at the same age.

## Verification

- 50 regression tests: run `node scripts/test-retirement-planner.mjs` or `npm run test:retirement`.
- Strict TypeScript checks on the calculation, simulation, optimizer, RAMP and persistence entrypoints.
- All 15 planner Svelte components compile without warnings.
- Browser checks use a synthetic plan: section navigation, account editing, near-ATH decision details, Social Security calculations and break-even results, Monte Carlo completion/cancel/restart and scenario tabs, optimizer completion/cancellation, completed RAMP analysis, chart rendering, and Save/reload.
- Responsive check at 390 × 844: no page-wide horizontal overflow; wide data tables scroll within their containers. Desktop layout checked with the normal browser viewport.
- Production Astro build passed (81 pages); final RAMP presentation adjustments also compiled without warnings.

## Model limits

This remains a planning model. ATH decisions happen once per projected year; intrayear highs and trading execution are not simulated. The speculative Bitcoin curves can produce very large values and have not been statistically validated in this review. Monte Carlo uses the existing historical/cycle assumptions.

Tax estimates omit state taxes, credits, age-based deductions, NIIT, detailed tax-lot treatment and Medicare surcharge cash costs. Roth headroom uses a conservative income proxy. Social Security retains the disclosed FRA-67/2026-baseline approximation; work-credit eligibility, cohort-specific benefit awards and spousal/survivor optimization are not modeled. Live prices and chart libraries depend on external availability. Backups and storage failure handling are regression-tested; no user's production plan was replaced.

## Reference data

- [IRS 2026 tax tables, deductions and capital-gains bands](https://www.irs.gov/irb/2025-45_IRB)
- [CMS 2026 Medicare income thresholds](https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles)
- [IRS required minimum distributions](https://www.irs.gov/retirement-plans/retirement-plan-and-ira-required-minimum-distributions-faqs)
- [IRS Social Security taxation, Publication 915](https://www.irs.gov/pub/irs-pdf/p915.pdf)
- [SSA bend points](https://www.ssa.gov/oact/cola/bendpoints.html)
- [SSA national average wage index](https://www.ssa.gov/oact/cola/AWI.html)
- [SSA contribution and benefit base](https://www.ssa.gov/oact/cola/cbb.html)
