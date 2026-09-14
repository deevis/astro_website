import type { ProjectionResult } from './cashflow';

export interface SequenceRiskReport {
  retirementAge: number;
  earlyRetirementCumulative: number;
  earlyRetirementYears: number;
  retiredYearCount: number;
  forcedSaleYears: number;
  runwayExhaustionYears: number;
  downYearCountWhileRetired: number;
  firstShortfallAge: number | null;
  maxDrawdownPct: number;
  liquidBufferYearsAtRetirement: number | null;
}

/** Sequence-of-returns metrics assembled from a deterministic projection path. */
export function computeSequenceRiskReport(
  result: ProjectionResult,
  retirementAge: number
): SequenceRiskReport {
  const retiredYears = result.years.filter((y) => y.age >= retirementAge);
  const earlyYears = retiredYears.filter((y) => y.age < retirementAge + 5);
  const earlyRetirementCumulative =
    earlyYears.reduce((acc, y) => acc * (1 + y.portfolioReturn), 1) - 1;

  let forcedSaleYears = 0;
  let runwayExhaustionYears = 0;
  let downYearCountWhileRetired = 0;
  let firstShortfallAge: number | null = null;
  let peak = 0;
  let maxDrawdownPct = 0;

  for (const y of result.years) {
    if (y.portfolioTotal > peak) peak = y.portfolioTotal;
    if (peak > 0) {
      const dd = (peak - y.portfolioTotal) / peak;
      if (dd > maxDrawdownPct) maxDrawdownPct = dd;
    }
    if (y.age < retirementAge) continue;
    if (y.downYear) downYearCountWhileRetired++;
    if (y.shortfall > 1 && firstShortfallAge == null) firstShortfallAge = y.age;
    const hadForcedRiskSale = y.events?.some(
      (e) =>
        e.kind === 'SpendingWithdraw' &&
        (e.accountType === 'brokerage' || e.accountType === 'traditionalIra' || e.accountType === 'traditional401k' || e.accountType === 'rothIra' || e.accountType === 'roth401k' || e.accountType === 'bitcoin' ||
          e.accountType === 'crypto' ||
          e.accountType === 'gold' ||
          e.accountType === 'silver')
    );
    if (hadForcedRiskSale) forcedSaleYears++;
    if (y.downYear && y.cash + y.bonds < y.expenses * 0.5) runwayExhaustionYears++;
  }

  const retYear = result.years.find((y) => y.age === retirementAge);
  const liquidBufferYearsAtRetirement =
    retYear && retYear.expenses > 0
      ? (retYear.cash + retYear.bonds) / retYear.expenses
      : null;

  return {
    retirementAge,
    earlyRetirementCumulative,
    earlyRetirementYears: earlyYears.length,
    retiredYearCount: retiredYears.length,
    forcedSaleYears,
    runwayExhaustionYears,
    downYearCountWhileRetired,
    firstShortfallAge,
    maxDrawdownPct,
    liquidBufferYearsAtRetirement,
  };
}

export interface AggregateSequenceRisk {
  meanEarlyRetirementCumulative: number;
  forcedSaleYearRate: number;
  runwayExhaustionRate: number;
  shortfallPathRate: number;
}

export function aggregateSequenceRisk(
  reports: SequenceRiskReport[]
): AggregateSequenceRisk {
  if (reports.length === 0) {
    return {
      meanEarlyRetirementCumulative: 0,
      forcedSaleYearRate: 0,
      runwayExhaustionRate: 0,
      shortfallPathRate: 0,
    };
  }
  const n = reports.length;
  return {
    meanEarlyRetirementCumulative:
      reports.reduce((s, r) => s + r.earlyRetirementCumulative, 0) / n,
    forcedSaleYearRate:
      reports.reduce((s, r) => s + r.forcedSaleYears, 0) /
      Math.max(1, reports.reduce((s, r) => s + r.retiredYearCount, 0)),
    runwayExhaustionRate:
      reports.reduce((s, r) => s + r.runwayExhaustionYears, 0) /
      Math.max(1, reports.reduce((s, r) => s + r.retiredYearCount, 0)),
    shortfallPathRate:
      reports.filter((r) => r.firstShortfallAge != null).length / n,
  };
}
