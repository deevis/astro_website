import {
  projectCashflow,
  type MutableAccount,
  type ProjectionResult,
  type ReturnOverrides,
} from './cashflow';
import {
  aggregateSequenceRisk,
  computeSequenceRiskReport,
  type AggregateSequenceRisk,
} from './sequenceRisk';
import {
  createSimulationRequest,
  simulationMetaFromRequest,
  type SimulationMeta,
} from './simulation';
import type { AccountYearSnapshot, SpendBreakdown } from './forensic';
import type { SimulationEvent } from './events';
import {
  createDefaultMarketCycle,
  type AccountType,
  type MarketRegime,
  type RetirementPlan,
} from './types';
import { pickOne, SP500_ANNUAL_RETURNS, SP500_STATS, HIST_PLAUSIBILITY, HIST_BOOM_THRESHOLD, createBlockBootstrap, historicalPlausibilityPenalty } from './historicalReturns';
import { calendarYearToModelDate } from './bitcoinPricingModels';
import {
  dampenDownsideReturn,
  getHalvingCyclePosition,
  halvingPhaseMeanReturn,
  halvingPhaseVolMultiplier,
} from './bitcoinHalvingCycle';

function isCashLike(type: AccountType): boolean {
  return type === 'hysa' || type === 'cd';
}

function isEquityLike(type: AccountType): boolean {
  return (
    type === 'traditionalIra' ||
    type === 'rothIra' ||
    type === 'traditional401k' ||
    type === 'roth401k' ||
    type === 'brokerage'
  );
}

export const FAILURE_CASES_TO_KEEP = 12;
export const FAILURE_CASES_TO_SHOW = 10;
export const SCENARIO_CASES_TO_SHOW = 10;

export interface FailureYearBeat {
  age: number;
  calendarYear: number;
  portfolio: number;
  portfolioReturn: number;
  /** Equity-like (IRA/Roth/brokerage) value-weighted return; null if none held */
  marketReturn: number | null;
  bitcoinReturn: number | null;
  cryptoReturn: number | null;
  goldReturn: number | null;
  silverReturn: number | null;
  /** Portfolio return points from each sleeve (weights × class return) */
  marketContribution: number;
  bitcoinContribution: number;
  cryptoContribution: number;
  goldContribution: number;
  silverContribution: number;
  withdrawal: number;
  shortfall: number;
  expenses: number;
  incomePlusSs: number;
  contributions: number;
  rmd: number;
  rothConversion: number;
  estimatedTax: number;
  downYear: boolean;
  expenseCut: number;
  spend: SpendBreakdown;
  accountsStart: AccountYearSnapshot[];
  accountsEnd: AccountYearSnapshot[];
  /** Key cashflow events for the year (growth ticks omitted). */
  events?: SimulationEvent[];
}

export type PathKind = 'failure' | 'worst' | 'moonshot' | 'average';

/** Detailed single-path story (failure, median, or moonshot). */
export interface FailureCase {
  kind?: PathKind;
  runIndex: number;
  depletedAge: number | null;
  firstShortfallAge: number | null;
  endingBalance: number;
  peakPortfolio: number;
  peakAge: number;
  maxDrawdownPct: number;
  /** Cumulative portfolio return over first N retirement years */
  earlyRetirementCumulative: number;
  earlyRetirementYears: number;
  worstYear: { age: number; portfolioReturn: number };
  bestYear: { age: number; portfolioReturn: number };
  longestNegativeStreak: number;
  /** Number of simulated recession years in this path */
  recessionYears: number;
  boomYears: number;
  circumstances: string[];
  /** Timeline for charting and forensic replay */
  timeline: FailureYearBeat[];
  simulationMeta?: SimulationMeta;
}

export type PathCase = FailureCase;

export interface MonteCarloProgress {
  type: 'progress';
  completed: number;
  total: number;
}

export interface MonteCarloResult {
  type: 'result';
  runs: number;
  successCount: number;
  successRate: number;
  successThreshold: number;
  meetsThreshold: boolean;
  ages: number[];
  /** Percentile portfolio paths by age index */
  p10: number[];
  p50: number[];
  p90: number[];
  endingBalances: number[];
  histogram: {
    binStart: number;
    binEnd: number;
    count: number;
    /** True for the open-ended top bin that catches outliers above the chart range */
    overflow?: boolean;
  }[];
  failureCases: FailureCase[];
  /** Top ending-balance success paths */
  moonshotCases: FailureCase[];
  /** Success paths whose ending balance sits near the median */
  averageCases: FailureCase[];
  failureCount: number;
  /** Share of all simulated years classified as recession / boom (sanity check vs config) */
  observedRecessionShare: number;
  observedBoomShare: number;
  simulationMeta: SimulationMeta;
  sequenceRisk: AggregateSequenceRisk;
}

export interface MonteCarloRequest {
  type: 'run';
  plan: RetirementPlan;
  runs?: number;
  seed?: number;
}

export type WorkerInMessage = MonteCarloRequest | { type: 'cancel' };
export type WorkerOutMessage = MonteCarloProgress | MonteCarloResult | { type: 'error'; message: string };

/** Mulberry32 PRNG */
export function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller normal sample */
export function randn(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function meanForAccount(acct: MutableAccount, plan: RetirementPlan): number {
  if (Number.isFinite(acct.expectedReturn)) return acct.expectedReturn;
  if (acct.type === 'crypto') return plan.assumptions.cryptoReturn;
  if (acct.type === 'bitcoin') return plan.assumptions.bitcoinReturn ?? 0.12;
  if (acct.type === 'gold') return plan.assumptions.goldReturn ?? 0.045;
  if (acct.type === 'silver') return plan.assumptions.silverReturn ?? 0.05;
  if (acct.type === 'bond') return plan.assumptions.bondReturn;
  if (isCashLike(acct.type)) return plan.assumptions.cashReturn ?? 0.04;
  return plan.assumptions.equityReturn;
}

export interface RegimeSampler {
  sample: (yearIndex: number, accounts: MutableAccount[]) => ReturnOverrides;
  /** Regime chosen for each simulated year, filled in as the run progresses */
  regimes: MarketRegime[];
}

/** No asset can lose more than this in a single year (a total loss is -100%). */
const MIN_ANNUAL_RETURN = -0.95;
/** Absolute hard cap — even crypto cannot invent 200–300% calendar years here. */
const MAX_ANNUAL_RETURN = 1.0;
/** Altcoins have seen ~−80% calendar years; allow that tail in worst paths. */
const CRYPTO_FLOOR = -0.8;
/** Soften altcoin upside vs history’s wildest years; still punchy above equities. */
const CRYPTO_CEIL = 0.85;
/** BTC worst calendar years approached ~−73%; keep a little headroom. */
const BITCOIN_FLOOR = -0.72;
/** BTC has had larger years, but retirement paths should not mint ~150% draws. */
const BITCOIN_CEIL = 0.65;
/** Altcoins amplify Bitcoin moves (rising tide / falling tide). */
const CRYPTO_BTC_BETA = 1.45;
const GOLD_FLOOR = -0.25;
const GOLD_CEIL = 0.4;
const SILVER_FLOOR = -0.4;
const SILVER_CEIL = 0.55;

function clampReturn(r: number, floor: number, ceil: number): number {
  return Math.min(ceil, Math.max(floor, r));
}

/**
 * Equities use a circular *block bootstrap* of real S&P calendar years so
 * sequences match history (no stacking independent recession/boom draws into
 * fantasy bear or melt-up markets). Equity losses are floored near the
 * historical worst (~−40%); gains are capped near the sample max (~+34%).
 * Boom streaks are capped like recession streaks. Bitcoin follows a halving-cycle
 * phase map (ATH formation ~44w, peak ~74w post-halving, bear to ~74w pre-next-halving); crypto amplifies
 * Bitcoin as the market heartbeat (beta ~1.45, floor −80%).
 */
export function makeReturnSampler(plan: RetirementPlan, rng: () => number): RegimeSampler {
  const cycle = plan.assumptions.marketCycle ?? createDefaultMarketCycle();
  const pRec = clamp01(cycle.recessionProbability);
  const pBoom = clamp01(cycle.boomProbability);
  const pNormal = Math.max(0.01, 1 - pRec - pBoom);
  const normalShift = -(pRec * cycle.recessionEquityShift + pBoom * cycle.boomEquityShift) / pNormal;

  const persistence = Math.min(clamp01(cycle.recessionPersistence), 0.9);
  const maxRecessionStreak = Math.max(1, Math.round(cycle.maxRecessionStreak ?? 3));
  const maxBoomStreak = Math.max(
    1,
    Math.round(cycle.maxBoomStreak ?? HIST_PLAUSIBILITY.maxConsecutiveBoom)
  );
  const recEntryProb = pRec >= 1 ? 1 : Math.min(1, (pRec * (1 - persistence)) / (1 - pRec));
  const boomGivenNotRec = clamp01(pBoom / Math.max(0.01, 1 - pRec));

  const useHist = cycle.useHistoricalEquityBootstrap !== false;
  const hist = SP500_STATS;
  const midYears = hist.midYears.length ? hist.midYears : [Math.max(0, hist.midMean)];
  const nonNegYears = [...hist.midYears, ...hist.boomYears];
  const nextHistEquity = useHist
    ? createBlockBootstrap(SP500_ANNUAL_RETURNS, rng, 8)
    : null;

  const shiftVariance =
    pRec * cycle.recessionEquityShift ** 2 +
    pBoom * cycle.boomEquityShift ** 2 +
    pNormal * normalShift ** 2;
  const cryptoMult = Math.min(cycle.cryptoRegimeMultiplier ?? 1.25, 1.5);
  const effectiveVol = (configuredVol: number, shiftScale: number): number => {
    const residual = configuredVol ** 2 - shiftVariance * shiftScale ** 2;
    return Math.sqrt(Math.max(residual, (configuredVol * 0.5) ** 2));
  };

  const regimes: MarketRegime[] = [];
  let prevRegime: MarketRegime = 'normal';
  let recessionStreak = 0;
  let boomStreak = 0;
  let negativeReturnStreak = 0;
  const recentEquity: number[] = [];

  const wouldViolate = (candidate: number): boolean => {
    const trial = [...recentEquity, candidate];
    if (trial.length < 3) {
      return (
        candidate < HIST_PLAUSIBILITY.equityFloor ||
        candidate >= HIST_PLAUSIBILITY.megaThreshold
      );
    }
    const slice = trial.slice(-Math.min(HIST_PLAUSIBILITY.windowYears, trial.length));
    return historicalPlausibilityPenalty(slice) < -2;
  };

  const sampleEquity = (opts: {
    forceNonNegative: boolean;
    forceNonBoom: boolean;
  }): number => {
    let raw: number;
    if (opts.forceNonBoom) {
      // Break melt-up streaks — sample a non-boom positive/mid year
      raw = pickOne(midYears, rng);
    } else if (nextHistEquity && !opts.forceNonNegative) {
      raw = nextHistEquity();
      if (wouldViolate(raw)) {
        // Downside fantasy → lift; upside fantasy → pull back to mid
        raw =
          raw < 0
            ? nonNegYears.length
              ? pickOne(nonNegYears, rng)
              : Math.max(0, hist.midMean)
            : pickOne(midYears, rng);
      }
    } else if (opts.forceNonNegative) {
      raw = nonNegYears.length ? pickOne(nonNegYears, rng) : Math.max(0, hist.midMean);
      if (raw >= HIST_BOOM_THRESHOLD && boomStreak >= maxBoomStreak - 1) {
        raw = pickOne(midYears, rng);
      }
    } else {
      const vol = effectiveVol(plan.assumptions.equityVolatility, 1);
      raw = plan.assumptions.equityReturn + normalShift + vol * randn(rng);
    }
    raw = clampReturn(raw, HIST_PLAUSIBILITY.equityFloor, HIST_PLAUSIBILITY.equityCeil);
    recentEquity.push(raw);
    if (recentEquity.length > HIST_PLAUSIBILITY.windowYears) recentEquity.shift();
    return raw;
  };

  const sample = (yearIndex: number, accounts: MutableAccount[]): ReturnOverrides => {
    let regime: MarketRegime;
    const canPersist =
      prevRegime === 'recession' &&
      recessionStreak < maxRecessionStreak &&
      rng() < persistence;
    if (canPersist) regime = 'recession';
    else if (prevRegime === 'recession') regime = rng() < boomGivenNotRec ? 'boom' : 'normal';
    else if (rng() < recEntryProb) regime = 'recession';
    else if (rng() < boomGivenNotRec) regime = 'boom';
    else regime = 'normal';

    const forceNonNegative = negativeReturnStreak >= maxRecessionStreak;
    const forceNonBoom = boomStreak >= maxBoomStreak;
    if (forceNonNegative && regime === 'recession') {
      regime = rng() < boomGivenNotRec ? 'boom' : 'normal';
    }
    if (forceNonBoom && regime === 'boom') {
      regime = 'normal';
    }

    const equityShift =
      regime === 'recession'
        ? cycle.recessionEquityShift
        : regime === 'boom'
          ? cycle.boomEquityShift
          : normalShift;

    const market = randn(rng);
    const bondNoise = 0.25 * market + 0.75 * randn(rng);
    const cashNoise = 0.1 * market + 0.9 * randn(rng);
    const cryptoNoise = 0.35 * market + 0.65 * randn(rng);
    const bitcoinNoise = 0.15 * market + 0.85 * randn(rng);
    const goldNoise = 0.1 * market + 0.9 * randn(rng);
    const silverNoise = 0.2 * market + 0.8 * randn(rng);

    const histEquity = useHist
      ? sampleEquity({ forceNonNegative, forceNonBoom })
      : null;

    if (histEquity != null) {
      if (histEquity < 0) {
        regime = 'recession';
        negativeReturnStreak += 1;
        recessionStreak += 1;
        boomStreak = 0;
      } else if (histEquity >= HIST_BOOM_THRESHOLD) {
        regime = 'boom';
        negativeReturnStreak = 0;
        recessionStreak = 0;
        boomStreak += 1;
      } else {
        regime = 'normal';
        negativeReturnStreak = 0;
        recessionStreak = 0;
        boomStreak = 0;
      }
    } else if (regime === 'recession') {
      recessionStreak += 1;
      boomStreak = 0;
    } else if (regime === 'boom') {
      boomStreak += 1;
      recessionStreak = 0;
    } else {
      recessionStreak = 0;
      boomStreak = 0;
    }

    prevRegime = regime;
    regimes[yearIndex] = regime;

    const cashVol = plan.assumptions.cashVolatility ?? 0.005;
    const btcVol = plan.assumptions.bitcoinVolatility ?? 0.35;
    const goldVol = plan.assumptions.goldVolatility ?? 0.16;
    const silverVol = plan.assumptions.silverVolatility ?? 0.28;
    const projectionStartYear = new Date().getFullYear();
    const cyclePos = getHalvingCyclePosition(calendarYearToModelDate(projectionStartYear + yearIndex));
    const phaseMean = halvingPhaseMeanReturn(cyclePos.phase, cyclePos.weeksSinceHalving);
    const phaseVolMult = halvingPhaseVolMultiplier(cyclePos.phase, cyclePos.weeksSinceHalving);

    const byAccountId: Record<string, number> = {};
    const baseBtcMean = plan.assumptions.bitcoinReturn ?? 0.12;
    const fixedBtc = plan.assumptions.bitcoinPricingModel === 'expectedReturn';
    const blendedBtcMean = fixedBtc ? baseBtcMean : baseBtcMean * 0.25 + phaseMean * 0.75 + equityShift * 0.25;
    const btcVolScaled = fixedBtc ? btcVol : effectiveVol(btcVol, 0.25) * phaseVolMult;
    const bitcoinReturnSample = clampReturn(
      dampenDownsideReturn(
        blendedBtcMean + btcVolScaled * bitcoinNoise,
        -0.48,
        BITCOIN_FLOOR
      ),
      BITCOIN_FLOOR,
      BITCOIN_CEIL
    );

    for (const acct of accounts) {
      let mean = meanForAccount(acct, plan);
      let r: number;

      if (acct.type === 'crypto') {
        // Sampled after Bitcoin — see below.
        continue;
      } else if (acct.type === 'bitcoin') {
        r = bitcoinReturnSample;
      } else if (acct.type === 'gold') {
        const vol = effectiveVol(goldVol, 0.1);
        r = clampReturn(mean + equityShift * 0.1 + vol * goldNoise, GOLD_FLOOR, GOLD_CEIL);
      } else if (acct.type === 'silver') {
        const vol = effectiveVol(silverVol, 0.2);
        r = clampReturn(mean + equityShift * 0.2 + vol * silverNoise, SILVER_FLOOR, SILVER_CEIL);
      } else if (acct.type === 'bond') {
        const vol = effectiveVol(plan.assumptions.bondVolatility, 0.25);
        r = clampReturn(mean + equityShift * 0.25 + vol * bondNoise, -0.2, 0.25);
      } else if (isCashLike(acct.type)) {
        const vol = effectiveVol(cashVol, 0.05);
        r = clampReturn(mean + equityShift * 0.05 + vol * cashNoise, -0.02, 0.12);
      } else if (histEquity != null && isEquityLike(acct.type)) {
        r = histEquity;
      } else {
        const vol = effectiveVol(plan.assumptions.equityVolatility, 1);
        r = clampReturn(
          mean + equityShift + vol * market,
          HIST_PLAUSIBILITY.equityFloor,
          HIST_PLAUSIBILITY.equityCeil
        );
      }

      byAccountId[acct.id] = clampReturn(r, MIN_ANNUAL_RETURN, MAX_ANNUAL_RETURN);
    }

    // Crypto rides Bitcoin as the market heartbeat; idiosyncratic alt noise on top.
    for (const acct of accounts) {
      if (acct.type !== 'crypto') continue;
      const mean = meanForAccount(acct, plan);
      const vol = effectiveVol(plan.assumptions.cryptoVolatility, cryptoMult);
      const altIdio = vol * cryptoNoise * 0.45;
      let r = dampenDownsideReturn(
        CRYPTO_BTC_BETA * bitcoinReturnSample +
          mean * 0.12 +
          equityShift * cryptoMult * 0.35 +
          altIdio,
        -0.58,
        CRYPTO_FLOOR
      );
      r = clampReturn(r, CRYPTO_FLOOR, CRYPTO_CEIL);
      byAccountId[acct.id] = clampReturn(r, MIN_ANNUAL_RETURN, MAX_ANNUAL_RETURN);
    }

    return { byAccountId };
  };

  return { sample, regimes };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

export interface EndingBalanceStats {
  p25: number;
  p50: number;
  p75: number;
  mean: number;
  stdev: number;
}

export function summarizeEndingBalances(endings: number[]): EndingBalanceStats {
  if (endings.length === 0) return { p25: 0, p50: 0, p75: 0, mean: 0, stdev: 0 };
  const sorted = [...endings].sort((a, b) => a - b);
  const mean = endings.reduce((s, x) => s + x, 0) / endings.length;
  const variance =
    endings.length < 2 ? 0 : endings.reduce((s, x) => s + (x - mean) ** 2, 0) / (endings.length - 1);
  return {
    p25: percentile(sorted, 0.25),
    p50: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    mean,
    stdev: Math.sqrt(variance),
  };
}

/**
 * Ending-balance histogram with doubling bucket widths so most of the signal
 * (typical funded outcomes) isn't crushed into one linear bin.
 *
 * - Dedicated $0 / depleted bar
 * - Edges: $0 → $1M → $2M → $4M → $8M → … (widths double after the first $1M)
 * - Open-ended overflow bar for anything above the last finite edge
 */
function buildHistogram(values: number[]): MonteCarloResult['histogram'] {
  if (values.length === 0) return [];

  const depletedThresh = 1;
  const depletedCount = values.filter((v) => v <= depletedThresh).length;
  const positive = values.filter((v) => v > depletedThresh);

  const bins: MonteCarloResult['histogram'] = [];

  if (depletedCount > 0) {
    bins.push({
      binStart: 0,
      binEnd: 0,
      count: depletedCount,
    });
  }

  if (positive.length === 0) {
    return bins;
  }

  const rawMax = Math.max(...positive);
  // Geometric ladder: 0, 1M, 2M, 4M, 8M, … up through the observed max.
  const base = 1_000_000;
  const edges: number[] = [0, base];
  let edge = base;
  const maxEdge = Math.max(base * 2, rawMax);
  // Cap ladder length so a pathological moonshot doesn't create dozens of empty bins
  while (edge < maxEdge && edges.length < 24) {
    edge *= 2;
    edges.push(edge);
  }

  const counts = Array.from({ length: edges.length - 1 }, () => 0);
  let overflow = 0;
  const lastEdge = edges[edges.length - 1]!;

  for (const v of positive) {
    if (v >= lastEdge) {
      overflow++;
      continue;
    }
    // Find first edge strictly greater than v → bin [edges[i-1], edges[i])
    let i = 1;
    while (i < edges.length && v >= edges[i]!) i++;
    counts[i - 1]!++;
  }

  for (let i = 0; i < counts.length; i++) {
    bins.push({
      binStart: edges[i]!,
      binEnd: edges[i + 1]!,
      count: counts[i]!,
    });
  }

  if (overflow > 0 || rawMax >= lastEdge) {
    bins.push({
      binStart: lastEdge,
      binEnd: Math.max(rawMax, lastEdge),
      count: overflow,
      overflow: true,
    });
  }

  return bins;
}

function formatPct(r: number): string {
  const sign = r >= 0 ? '+' : '';
  return `${sign}${(r * 100).toFixed(1)}%`;
}

function formatMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

export function analyzePath(
  runIndex: number,
  result: ProjectionResult,
  retirementAge: number,
  regimes: MarketRegime[] = [],
  tone: PathKind = 'failure'
): FailureCase {
  let peakPortfolio = 0;
  let peakAge = result.years[0]?.age ?? 0;
  let troughAfterPeak = Infinity;
  let maxDrawdownPct = 0;
  let peakForDd = 0;

  let worstYear = { age: result.years[0]?.age ?? 0, portfolioReturn: 0 };
  let bestYear = { age: result.years[0]?.age ?? 0, portfolioReturn: 0 };
  let streak = 0;
  let longestNegativeStreak = 0;

  const earlyReturns: number[] = [];
  let firstShortfallAge: number | null = null;

  for (const y of result.years) {
    if (y.portfolioTotal > peakPortfolio) {
      peakPortfolio = y.portfolioTotal;
      peakAge = y.age;
    }
    if (y.portfolioTotal > peakForDd) peakForDd = y.portfolioTotal;
    if (peakForDd > 0) {
      const dd = (peakForDd - y.portfolioTotal) / peakForDd;
      if (dd > maxDrawdownPct) maxDrawdownPct = dd;
    }
    if (y.portfolioTotal < troughAfterPeak) troughAfterPeak = y.portfolioTotal;

    if (y.portfolioReturn < worstYear.portfolioReturn) {
      worstYear = { age: y.age, portfolioReturn: y.portfolioReturn };
    }
    if (y.portfolioReturn > bestYear.portfolioReturn) {
      bestYear = { age: y.age, portfolioReturn: y.portfolioReturn };
    }

    if (y.portfolioReturn < 0) {
      streak++;
      longestNegativeStreak = Math.max(longestNegativeStreak, streak);
    } else {
      streak = 0;
    }

    if (y.isRetired && earlyReturns.length < 5) {
      earlyReturns.push(y.portfolioReturn);
    }

    if (y.shortfall > 1 && firstShortfallAge == null) {
      firstShortfallAge = y.age;
    }
  }

  const earlyRetirementCumulative = earlyReturns.reduce((acc, r) => acc * (1 + r), 1) - 1;

  const endAge = result.years[result.years.length - 1]?.age ?? 0;
  const cutAge =
    tone === 'failure' || tone === 'worst'
      ? (result.depletedAge ?? firstShortfallAge ?? endAge)
      : endAge;

  const rawYears = result.years.filter(
    (y) => y.age <= cutAge + (tone === 'failure' || tone === 'worst' ? 2 : 0)
  );

  // Keep every year for forensic replay (no subsampling).
  const timeline: FailureYearBeat[] = rawYears.map((y) => ({
      age: y.age,
      calendarYear: y.calendarYear,
      portfolio: y.portfolioTotal,
      portfolioReturn: y.portfolioReturn,
      marketReturn: y.marketReturn,
      bitcoinReturn: y.bitcoinReturn,
      cryptoReturn: y.cryptoReturn,
      goldReturn: y.goldReturn,
      silverReturn: y.silverReturn,
      marketContribution: y.marketContribution,
      bitcoinContribution: y.bitcoinContribution,
      cryptoContribution: y.cryptoContribution,
      goldContribution: y.goldContribution,
      silverContribution: y.silverContribution,
      withdrawal: y.withdrawals,
      shortfall: y.shortfall,
      expenses: y.expenses,
      incomePlusSs: y.income + y.socialSecurity,
      contributions: y.contributions,
      rmd: y.rmd,
      rothConversion: y.rothConversion,
      estimatedTax: y.estimatedTax ?? 0,
      downYear: y.downYear,
      expenseCut: y.expenseCut,
      spend: y.spend ?? {
        general: y.expenses,
        travel: 0,
        healthInsurance: 0,
        total: y.expenses,
      },
      accountsStart: y.accountsStart ?? [],
      accountsEnd: y.accountsEnd ?? [],
      events: (y.events ?? []).filter(
        (e) => e.kind !== 'MarketGrowth' && e.kind !== 'Expense'
      ),
    }));

  const recessionAges = regimes
    .map((r, i) => (r === 'recession' ? result.years[i]?.age : null))
    .filter((a): a is number => a != null);
  const boomAges = regimes
    .map((r, i) => (r === 'boom' ? result.years[i]?.age : null))
    .filter((a): a is number => a != null);

  const circumstances: string[] = [];

  if (tone === 'failure' || tone === 'worst') {
    if (tone === 'failure') {
      if (result.depletedAge != null) {
        circumstances.push(
          `Portfolio effectively depleted at age ${result.depletedAge} with spending left unpaid.`
        );
      } else if (firstShortfallAge != null) {
        circumstances.push(
          `First spending shortfall at age ${firstShortfallAge} (portfolio still positive but withdrawals could not cover expenses).`
        );
      }
    } else if (result.failed) {
      if (result.depletedAge != null) {
        circumstances.push(
          `Portfolio depleted at age ${result.depletedAge} — among the worst outcomes in this simulation batch.`
        );
      } else if (firstShortfallAge != null) {
        circumstances.push(
          `Spending shortfall from age ${firstShortfallAge} — a lower-tail path even though some assets remained.`
        );
      }
    } else {
      circumstances.push(
        `Lower-tail outcome: plan still funded, but ending balance ${formatMoney(result.endingBalance)} at age ${endAge} was among the weakest in this batch.`
      );
    }
    circumstances.push(
      `Peak wealth ${formatMoney(peakPortfolio)} at age ${peakAge}, then a max drawdown of ${(maxDrawdownPct * 100).toFixed(0)}%.`
    );
    if (earlyReturns.length > 0) {
      circumstances.push(
        `Sequence risk: first ${earlyReturns.length} retirement year(s) (from age ${retirementAge}) returned ${formatPct(earlyRetirementCumulative)} cumulative.`
      );
      const earlyList = earlyReturns.map((r, i) => `y${i + 1} ${formatPct(r)}`).join(', ');
      circumstances.push(`Early retirement return sequence: ${earlyList}.`);
    }
    circumstances.push(
      `Worst single market year: age ${worstYear.age} at ${formatPct(worstYear.portfolioReturn)}.`
    );
    if (longestNegativeStreak >= 2) {
      circumstances.push(
        `Longest streak of negative portfolio years: ${longestNegativeStreak} in a row.`
      );
    }
    if (recessionAges.length > 0) {
      const shown = recessionAges.slice(0, 6).join(', ');
      const suffix = recessionAges.length > 6 ? ', …' : '';
      circumstances.push(
        `${recessionAges.length} recession year(s) hit this path (ages ${shown}${suffix}).`
      );
      const earlyRecessions = recessionAges.filter(
        (a) => a >= retirementAge && a <= retirementAge + 5
      );
      if (earlyRecessions.length >= 2) {
        circumstances.push(
          `Critically, ${earlyRecessions.length} recessions landed within the first 5 years of retirement — the classic sequence-of-returns trap.`
        );
      }
    }
    const shortfallYears = result.years.filter((y) => y.shortfall > 1);
    if (shortfallYears.length > 0) {
      const avgShort = shortfallYears.reduce((s, y) => s + y.shortfall, 0) / shortfallYears.length;
      circumstances.push(
        `${shortfallYears.length} year(s) with shortfalls; average gap ${formatMoney(avgShort)}/yr when funding failed.`
      );
    }
    const nearFail = result.years.filter(
      (y) =>
        (result.depletedAge != null &&
          y.age >= result.depletedAge - 5 &&
          y.age <= result.depletedAge) ||
        (firstShortfallAge != null &&
          y.age >= firstShortfallAge - 3 &&
          y.age <= firstShortfallAge)
    );
    if (nearFail.length) {
      const avgWd = nearFail.reduce((s, y) => s + y.withdrawals, 0) / nearFail.length;
      circumstances.push(
        `In the years leading into the weakest stretch, average portfolio withdrawals were ~${formatMoney(avgWd)}/yr.`
      );
    }
    const btcYears = result.years.filter((y) => y.bitcoinReturn != null);
    const cryptoYears = result.years.filter((y) => y.cryptoReturn != null);
    if (btcYears.length > 0) {
      const worstBtcYear = btcYears.reduce((a, b) =>
        (a.bitcoinReturn ?? 0) < (b.bitcoinReturn ?? 0) ? a : b
      );
      circumstances.push(
        `Worst Bitcoin year on this path: age ${worstBtcYear.age} at ${formatPct(worstBtcYear.bitcoinReturn ?? 0)}.`
      );
    }
    if (cryptoYears.length > 0) {
      const worstCryptoYear = cryptoYears.reduce((a, b) =>
        (a.cryptoReturn ?? 0) < (b.cryptoReturn ?? 0) ? a : b
      );
      circumstances.push(
        `Worst crypto year on this path: age ${worstCryptoYear.age} at ${formatPct(worstCryptoYear.cryptoReturn ?? 0)}.`
      );
    }
  } else if (tone === 'moonshot') {
    circumstances.push(
      `Moonshot ending balance ${formatMoney(result.endingBalance)} at age ${endAge}.`
    );
    circumstances.push(
      `Peak wealth ${formatMoney(peakPortfolio)} at age ${peakAge} (max drawdown along the way: ${(maxDrawdownPct * 100).toFixed(0)}%).`
    );
    if (earlyReturns.length > 0) {
      circumstances.push(
        `Early retirement sequence (from age ${retirementAge}): ${earlyReturns.map((r, i) => `y${i + 1} ${formatPct(r)}`).join(', ')} — cumulative ${formatPct(earlyRetirementCumulative)}.`
      );
    }
    circumstances.push(
      `Best single year: age ${bestYear.age} at ${formatPct(bestYear.portfolioReturn)}; worst: age ${worstYear.age} at ${formatPct(worstYear.portfolioReturn)}.`
    );
    if (boomAges.length > 0) {
      circumstances.push(
        `${boomAges.length} boom year(s) (≥20% equity-like gains) powered compounding on this path.`
      );
    }
    circumstances.push(
      `Spending stayed funded through life expectancy — this is an upper-tail success, not a forecast.`
    );
  } else {
    circumstances.push(
      `Ended near the middle of the pack at ${formatMoney(result.endingBalance)} (age ${endAge}).`
    );
    circumstances.push(
      `Peak wealth ${formatMoney(peakPortfolio)} at age ${peakAge}; max drawdown ${(maxDrawdownPct * 100).toFixed(0)}%.`
    );
    if (earlyReturns.length > 0) {
      circumstances.push(
        `Early retirement returns (from age ${retirementAge}): ${earlyReturns.map((r, i) => `y${i + 1} ${formatPct(r)}`).join(', ')} — cumulative ${formatPct(earlyRetirementCumulative)}.`
      );
    }
    circumstances.push(
      `Best year ${formatPct(bestYear.portfolioReturn)} (age ${bestYear.age}); worst ${formatPct(worstYear.portfolioReturn)} (age ${worstYear.age}).`
    );
    circumstances.push(
      `${recessionAges.length} down year(s) and ${boomAges.length} boom year(s) — a representative “things went about as expected” path.`
    );
  }

  return {
    kind: tone,
    runIndex,
    depletedAge: result.depletedAge,
    firstShortfallAge,
    endingBalance: result.endingBalance,
    peakPortfolio,
    peakAge,
    maxDrawdownPct,
    earlyRetirementCumulative,
    earlyRetirementYears: earlyReturns.length,
    worstYear,
    bestYear,
    longestNegativeStreak,
    recessionYears: recessionAges.length,
    boomYears: boomAges.length,
    circumstances,
    timeline,
    simulationMeta: result.simulationMeta,
  };
}

/** @deprecated Prefer analyzePath — kept for call-site clarity on failures. */
export function analyzeFailure(
  runIndex: number,
  result: ProjectionResult,
  retirementAge: number,
  regimes: MarketRegime[] = []
): FailureCase {
  return analyzePath(runIndex, result, retirementAge, regimes, 'failure');
}

/** Prefer historically plausible failure stories for the UI. */
export function selectWorstCases(cases: FailureCase[], count = FAILURE_CASES_TO_SHOW): FailureCase[] {
  const scored = cases.map((c) => {
    const returns = c.timeline.map((t) => t.portfolioReturn);
    return { c, penalty: historicalPlausibilityPenalty(returns) };
  });

  // Keep only paths that could actually happen in equity history (penalty === 0).
  // If none qualify, fall back to the least-implausible failures rather than
  // showing fantasy −48% / 8-of-14 down-year markets.
  const plausible = scored.filter((s) => s.penalty === 0).map((s) => s.c);
  const pool =
    plausible.length > 0
      ? plausible
      : scored
          .sort((a, b) => b.penalty - a.penalty)
          .slice(0, Math.max(count * 2, 10))
          .map((s) => s.c);

  if (pool.length <= count) return [...pool].sort(compareFailureInterest);

  const selected: FailureCase[] = [];
  const remaining = [...pool];

  const take = (score: (c: FailureCase) => number) => {
    if (!remaining.length || selected.length >= count) return;
    remaining.sort((a, b) => score(b) - score(a));
    const pick = remaining.shift();
    if (pick) selected.push(pick);
  };

  take((c) => -(c.depletedAge ?? c.firstShortfallAge ?? 999));
  take((c) => c.depletedAge ?? c.firstShortfallAge ?? 0);
  take((c) => -c.earlyRetirementCumulative);
  take((c) => c.maxDrawdownPct);
  take((c) => -c.worstYear.portfolioReturn);
  take((c) => c.longestNegativeStreak);

  remaining.sort(compareFailureInterest);
  while (selected.length < count && remaining.length) {
    selected.push(remaining.shift()!);
  }

  return selected.sort(compareFailureInterest);
}

/** @deprecated Use selectWorstCases */
export const selectFailureCases = selectWorstCases;

/** Higher score = worse outcome (for reservoir sampling). */
export function worstPathScore(c: FailureCase): number {
  if (c.depletedAge != null) return 1e9 - c.depletedAge * 1e6 + c.maxDrawdownPct * 100;
  if (c.firstShortfallAge != null) return 5e8 - c.firstShortfallAge * 1e6 + c.maxDrawdownPct * 100;
  return (
    c.maxDrawdownPct * 1e6 -
    c.endingBalance / 1000 +
    Math.max(0, -c.earlyRetirementCumulative) * 1e5
  );
}

function compareFailureInterest(a: FailureCase, b: FailureCase): number {
  const ageA = a.depletedAge ?? a.firstShortfallAge ?? 999;
  const ageB = b.depletedAge ?? b.firstShortfallAge ?? 999;
  if (ageA !== ageB) return ageA - ageB;
  return b.maxDrawdownPct - a.maxDrawdownPct;
}

/** Highest ending balances among successful paths — prefer historically plausible melt-ups. */
export function selectMoonshotCases(
  cases: FailureCase[],
  count = SCENARIO_CASES_TO_SHOW
): FailureCase[] {
  const scored = cases.map((c) => {
    const returns = c.timeline.map((t) => t.portfolioReturn);
    return { c, penalty: historicalPlausibilityPenalty(returns) };
  });

  const plausible = scored.filter((s) => s.penalty === 0).map((s) => s.c);
  const pool =
    plausible.length > 0
      ? plausible
      : scored
          .sort((a, b) => b.penalty - a.penalty)
          .slice(0, Math.max(count * 2, 10))
          .map((s) => s.c);

  return [...pool].sort((a, b) => b.endingBalance - a.endingBalance).slice(0, count);
}

/** Paths whose ending balance is closest to the simulation median. */
export function selectAverageCases(
  cases: FailureCase[],
  medianEnding: number,
  count = SCENARIO_CASES_TO_SHOW
): FailureCase[] {
  return [...cases]
    .sort(
      (a, b) =>
        Math.abs(a.endingBalance - medianEnding) - Math.abs(b.endingBalance - medianEnding)
    )
    .slice(0, count)
    .sort((a, b) => a.endingBalance - b.endingBalance);
}

function* iterateMonteCarloBatch(
  plan: RetirementPlan,
  options: {
    runs: number;
    seed?: number;
    asOfDate?: Date;
    onProgress?: (completed: number, total: number) => void;
    shouldCancel?: () => boolean;
  }
): Generator<void, MonteCarloResult> {
  const runs = Number.isFinite(options.runs) ? Math.max(100, Math.min(Math.round(options.runs), 10000)) : 1000;
  const seed = options.seed ?? Date.now();
  const asOfDate = options.asOfDate ?? new Date();
  const rng = createRng(seed);
  const successThreshold = plan.assumptions.successThreshold;

  const endingBalances: number[] = [];
  let pathByAge: number[][] = [];
  let ages: number[] = [];
  let successCount = 0;

  const worstPool: FailureCase[] = [];
  const moonshotPool: FailureCase[] = [];
  const successReservoir: FailureCase[] = [];
  const sequenceReports: ReturnType<typeof computeSequenceRiskReport>[] = [];
  const maxWorstPool = Math.max(FAILURE_CASES_TO_KEEP * 2, 40);
  const maxMoonshotPool = SCENARIO_CASES_TO_SHOW + 5;
  const maxSuccessReservoir = Math.max(SCENARIO_CASES_TO_SHOW * 8, 80);

  let totalYears = 0;
  let recessionYearsTotal = 0;
  let boomYearsTotal = 0;

  for (let i = 0; i < runs; i++) {
    if (options.shouldCancel?.()) throw new DOMException('Simulation cancelled', 'AbortError');

    const sampler = makeReturnSampler(plan, rng);
    const runSeed = seed + i;
    const result = projectCashflow(plan, {
      returnsForYear: sampler.sample,
      quiet: true,
      seed: runSeed,
      asOfDate,
    });

    if (i < 50) {
      sequenceReports.push(
        computeSequenceRiskReport(result, plan.primary.retirementAge)
      );
    }

    totalYears += sampler.regimes.length;
    for (const r of sampler.regimes) {
      if (r === 'recession') recessionYearsTotal++;
      else if (r === 'boom') boomYearsTotal++;
    }

    if (i === 0) {
      ages = result.years.map((y) => y.age);
      pathByAge = ages.map(() => []);
    }

    endingBalances.push(result.endingBalance);
    result.years.forEach((y, yi) => {
      if (pathByAge[yi]) pathByAge[yi].push(y.portfolioTotal);
    });

    const pathStory = analyzePath(
      i,
      result,
      plan.primary.retirementAge,
      sampler.regimes,
      'worst'
    );

    if (worstPool.length < maxWorstPool) {
      worstPool.push(pathStory);
    } else {
      let weakestIdx = 0;
      let weakestScore = worstPathScore(worstPool[0]!);
      for (let j = 1; j < worstPool.length; j++) {
        const s = worstPathScore(worstPool[j]!);
        if (s < weakestScore) {
          weakestScore = s;
          weakestIdx = j;
        }
      }
      if (worstPathScore(pathStory) > weakestScore) {
        worstPool[weakestIdx] = pathStory;
      }
    }

    if (!result.failed) {
      successCount++;
      const path = analyzePath(i, result, plan.primary.retirementAge, sampler.regimes, 'average');

      moonshotPool.push(path);
      moonshotPool.sort((a, b) => b.endingBalance - a.endingBalance);
      if (moonshotPool.length > maxMoonshotPool) moonshotPool.length = maxMoonshotPool;

      if (successReservoir.length < maxSuccessReservoir) {
        successReservoir.push(path);
      } else if (rng() < maxSuccessReservoir / successCount) {
        successReservoir[Math.floor(rng() * maxSuccessReservoir)] = path;
      }
    }

    if (i % 25 === 0 || i === runs - 1) {
      options.onProgress?.(i + 1, runs);
      yield;
    }
  }

  const p10: number[] = [];
  const p50: number[] = [];
  const p90: number[] = [];
  for (const series of pathByAge) {
    const sorted = [...series].sort((a, b) => a - b);
    p10.push(percentile(sorted, 0.1));
    p50.push(percentile(sorted, 0.5));
    p90.push(percentile(sorted, 0.9));
  }

  const completed = endingBalances.length;
  const successRate = completed > 0 ? successCount / completed : 0;
  const sortedEndings = [...endingBalances].sort((a, b) => a - b);
  const medianEnding = percentile(sortedEndings, 0.5);

  const moonshotCases = selectMoonshotCases(moonshotPool, SCENARIO_CASES_TO_SHOW).map((c) =>
    analyzePathTone(c, 'moonshot')
  );
  const averageCases = selectAverageCases(
    successReservoir,
    medianEnding,
    SCENARIO_CASES_TO_SHOW
  ).map((c) => analyzePathTone(c, 'average'));

  const simRequest = createSimulationRequest(plan, {
    runs,
    seed,
    quiet: true,
  });

  return {
    type: 'result',
    runs: completed,
    successCount,
    successRate,
    successThreshold,
    meetsThreshold: successRate >= successThreshold,
    ages,
    p10,
    p50,
    p90,
    endingBalances,
    histogram: buildHistogram(endingBalances),
    failureCases: selectWorstCases(worstPool, FAILURE_CASES_TO_SHOW),
    moonshotCases,
    averageCases,
    failureCount: completed - successCount,
    observedRecessionShare: totalYears > 0 ? recessionYearsTotal / totalYears : 0,
    observedBoomShare: totalYears > 0 ? boomYearsTotal / totalYears : 0,
    simulationMeta: simulationMetaFromRequest(simRequest, seed),
    sequenceRisk: aggregateSequenceRisk(sequenceReports),
  };
}

export function runMonteCarloBatch(plan: RetirementPlan, options: Parameters<typeof iterateMonteCarloBatch>[1]): MonteCarloResult {
  const iterator = iterateMonteCarloBatch(plan, options);
  let step = iterator.next();
  while (!step.done) step = iterator.next();
  return step.value;
}

/** Identical samples to the worker, yielding between chunks for responsive cancellation. */
export async function runMonteCarloAsync(plan: RetirementPlan, options: Parameters<typeof iterateMonteCarloBatch>[1]): Promise<MonteCarloResult> {
  const iterator = iterateMonteCarloBatch(plan, options);
  let step = iterator.next();
  while (!step.done) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (options.shouldCancel?.()) throw new DOMException('Simulation cancelled', 'AbortError');
    step = iterator.next();
  }
  return step.value;
}

/** Refresh circumstance copy for a stored path without re-simulating. */
function analyzePathTone(c: FailureCase, tone: 'moonshot' | 'average'): FailureCase {
  const endAge = c.timeline[c.timeline.length - 1]?.age ?? 0;
  if (tone === 'moonshot') {
    return {
      ...c,
      kind: tone,
      circumstances: [
        `Moonshot ending balance ${formatMoney(c.endingBalance)} at age ${endAge}.`,
        `Peak wealth ${formatMoney(c.peakPortfolio)} at age ${c.peakAge} (max drawdown ${(c.maxDrawdownPct * 100).toFixed(0)}%).`,
        c.earlyRetirementYears > 0
          ? `Early retirement cumulative return: ${formatPct(c.earlyRetirementCumulative)} over ${c.earlyRetirementYears} year(s).`
          : `Spending stayed funded through the plan horizon.`,
        `Best year ${formatPct(c.bestYear.portfolioReturn)} (age ${c.bestYear.age}); worst ${formatPct(c.worstYear.portfolioReturn)} (age ${c.worstYear.age}).`,
        `${c.boomYears} boom year(s) and ${c.recessionYears} down year(s) on this upper-tail path — illustrative, not a forecast.`,
      ],
    };
  }
  return {
    ...c,
    kind: tone,
    circumstances: [
      `Ended near the middle of the pack at ${formatMoney(c.endingBalance)} (age ${endAge}).`,
      `Peak wealth ${formatMoney(c.peakPortfolio)} at age ${c.peakAge}; max drawdown ${(c.maxDrawdownPct * 100).toFixed(0)}%.`,
      c.earlyRetirementYears > 0
        ? `Early retirement cumulative return: ${formatPct(c.earlyRetirementCumulative)} over ${c.earlyRetirementYears} year(s).`
        : `Portfolio funded planned spending through life expectancy.`,
      `Best year ${formatPct(c.bestYear.portfolioReturn)} (age ${c.bestYear.age}); worst ${formatPct(c.worstYear.portfolioReturn)} (age ${c.worstYear.age}).`,
      `${c.recessionYears} down year(s) and ${c.boomYears} boom year(s) — a representative “about as expected” path.`,
    ],
  };
}

/** Stable JSON payload for copying a saved Monte Carlo scenario. */
export function scenarioExportPayload(
  scenario: FailureCase,
  opts: { tab: string; batchSimulationMeta?: SimulationMeta | null }
) {
  return {
    kind: 'retirementPlanner.monteCarloScenario' as const,
    version: 1 as const,
    tab: opts.tab,
    batchSimulationMeta: opts.batchSimulationMeta ?? scenario.simulationMeta ?? null,
    scenario,
  };
}
