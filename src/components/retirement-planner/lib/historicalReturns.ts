/**
 * S&P 500 calendar-year total returns (decimal), from Yahoo monthly closes
 * resampled year-end (see python/retirement-planner/historical_yoy_returns.csv).
 * Years 1986–2025 inclusive. Partial/current year omitted from the model set.
 */
export const SP500_ANNUAL_RETURNS: readonly number[] = [
  0.1462, 0.0203, 0.124, 0.2725, -0.0656, 0.2631, 0.0446, 0.0706, -0.0154, 0.3411,
  0.2026, 0.3101, 0.2667, 0.1953, -0.1014, -0.1304, -0.2337, 0.2638, 0.0899, 0.03,
  0.1362, 0.0353, -0.3849, 0.2345, 0.1278, -0.0, 0.1341, 0.296, 0.1139, -0.0073,
  0.0954, 0.1942, -0.0624, 0.2888, 0.1626, 0.2689, -0.1944, 0.2423, 0.2331, 0.1639,
];

/** Boom threshold used when partitioning history (calendar-year gain ≥ 20%). */
export const HIST_BOOM_THRESHOLD = 0.2;

/** Observed extremes in the S&P sample (1986–2025). */
export const HIST_MIN_ANNUAL = Math.min(...SP500_ANNUAL_RETURNS);
export const HIST_MAX_ANNUAL = Math.max(...SP500_ANNUAL_RETURNS);

/**
 * Plausibility caps derived from rolling 14-year windows in the S&P sample
 * (1986–2025). Slightly looser than the single worst/best window so Monte Carlo
 * still has room without inventing fantasy markets.
 *
 * Downside (worst 14y): 5 down years, 1 year &lt; −15%, 0 years &lt; −40%, max streak 3.
 * Upside (best 14y): 6 boom years (≥20%), 2 strong years (≥30%), max boom streak 4,
 * calendar-year max ≈ +34%.
 */
export const HIST_PLAUSIBILITY = {
  windowYears: 14,
  /** Worst 14y window had 5; allow 6 */
  maxNegativeYears: 6,
  /** Full sample has 3 years &lt; −15%; worst 14y had 1 — allow 2 in a window */
  maxSevereYears: 2,
  /** No calendar year in sample lost more than ~38.5% */
  maxDeepYears: 0,
  deepThreshold: -0.4,
  severeThreshold: -0.15,
  maxConsecutiveNegative: 3,
  /** Floor applied to equity draws (at/just beyond 2008) */
  equityFloor: -0.4,
  /** Ceiling just above sample max (+34.1% in 1995) */
  equityCeil: 0.35,

  // --- Upside (mirror of downside guardrails) ---
  /** Best 14y window had 6 boom years (≥20%); allow 7 */
  maxBoomYears: 7,
  /** Best 14y had 2 years ≥30%; allow 3 */
  maxStrongYears: 3,
  /** No S&P calendar year in sample reached +40% */
  maxMegaYears: 0,
  boomThreshold: HIST_BOOM_THRESHOLD,
  strongThreshold: 0.3,
  megaThreshold: 0.4,
  /** Longest ≥20% streak in sample is 4 (1995–98); allow 5 */
  maxConsecutiveBoom: 5,
} as const;

/**
 * Score how historically plausible a return sequence is.
 * 0 = within bounds; more negative = more fantasy.
 */
export function historicalPlausibilityPenalty(returns: number[]): number {
  if (returns.length === 0) return 0;
  const {
    windowYears,
    maxNegativeYears,
    maxSevereYears,
    maxDeepYears,
    deepThreshold,
    severeThreshold,
    maxConsecutiveNegative,
    maxBoomYears,
    maxStrongYears,
    maxMegaYears,
    boomThreshold,
    strongThreshold,
    megaThreshold,
    maxConsecutiveBoom,
  } = HIST_PLAUSIBILITY;

  let penalty = 0;
  const w = Math.min(windowYears, returns.length);

  // Scan every window of length w
  for (let start = 0; start <= returns.length - w; start++) {
    const slice = returns.slice(start, start + w);
    const neg = slice.filter((r) => r < 0).length;
    const severe = slice.filter((r) => r < severeThreshold).length;
    const deep = slice.filter((r) => r < deepThreshold).length;
    const boom = slice.filter((r) => r >= boomThreshold).length;
    const strong = slice.filter((r) => r >= strongThreshold).length;
    const mega = slice.filter((r) => r >= megaThreshold).length;

    let negStreak = 0;
    let maxNegStreak = 0;
    let boomStreak = 0;
    let maxBoomStreak = 0;
    for (const r of slice) {
      if (r < 0) {
        negStreak++;
        maxNegStreak = Math.max(maxNegStreak, negStreak);
      } else negStreak = 0;
      if (r >= boomThreshold) {
        boomStreak++;
        maxBoomStreak = Math.max(maxBoomStreak, boomStreak);
      } else boomStreak = 0;
    }

    if (neg > maxNegativeYears) penalty += neg - maxNegativeYears;
    if (severe > maxSevereYears) penalty += 2 * (severe - maxSevereYears);
    if (deep > maxDeepYears) penalty += 5 * (deep - maxDeepYears);
    if (maxNegStreak > maxConsecutiveNegative) {
      penalty += 3 * (maxNegStreak - maxConsecutiveNegative);
    }

    if (boom > maxBoomYears) penalty += boom - maxBoomYears;
    if (strong > maxStrongYears) penalty += 2 * (strong - maxStrongYears);
    if (mega > maxMegaYears) penalty += 5 * (mega - maxMegaYears);
    if (maxBoomStreak > maxConsecutiveBoom) {
      penalty += 3 * (maxBoomStreak - maxConsecutiveBoom);
    }
  }

  // Single-year extremes beyond historical equity bounds
  for (const r of returns) {
    if (r < HIST_PLAUSIBILITY.equityFloor) penalty += 4;
    // No S&P calendar year in sample reached +40%
    if (r >= HIST_PLAUSIBILITY.megaThreshold) penalty += 4;
  }

  return -penalty;
}

export function isHistoricallyPlausible(returns: number[]): boolean {
  return historicalPlausibilityPenalty(returns) === 0;
}

/**
 * Circular block bootstrap over historical annual returns.
 * Contiguous blocks preserve real sequences (e.g. 2000–02) without
 * independently stacking recession draws into fantasy bear markets.
 */
export function createBlockBootstrap(
  returns: readonly number[],
  rng: () => number,
  blockLength = 8
): () => number {
  const n = returns.length;
  const len = Math.max(2, Math.min(blockLength, n));
  let buffer: number[] = [];
  let idx = 0;

  const refill = () => {
    const start = Math.floor(rng() * n);
    buffer = [];
    for (let k = 0; k < len; k++) {
      buffer.push(returns[(start + k) % n]!);
    }
    idx = 0;
  };

  refill();

  return () => {
    if (idx >= buffer.length) refill();
    return buffer[idx++]!;
  };
}

export interface HistoricalReturnStats {
  mean: number;
  std: number;
  downProbability: number;
  /** P(down year | previous year was down) */
  downPersistence: number;
  boomProbability: number;
  maxDownStreak: number;
  downMean: number;
  boomMean: number;
  midMean: number;
  downYears: number[];
  boomYears: number[];
  midYears: number[];
}

function computeStats(returns: readonly number[]): HistoricalReturnStats {
  const n = returns.length;
  const mean = returns.reduce((s, r) => s + r, 0) / n;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);

  const downYears = returns.filter((r) => r < 0);
  const boomYears = returns.filter((r) => r >= HIST_BOOM_THRESHOLD);
  const midYears = returns.filter((r) => r >= 0 && r < HIST_BOOM_THRESHOLD);

  let persist = 0;
  let downFollowed = 0;
  for (let i = 0; i < n - 1; i++) {
    if (returns[i] < 0) {
      downFollowed++;
      if (returns[i + 1] < 0) persist++;
    }
  }

  let maxDownStreak = 0;
  let cur = 0;
  for (const r of returns) {
    if (r < 0) {
      cur++;
      maxDownStreak = Math.max(maxDownStreak, cur);
    } else {
      cur = 0;
    }
  }

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((s, r) => s + r, 0) / arr.length : 0;

  return {
    mean,
    std,
    downProbability: downYears.length / n,
    downPersistence: downFollowed > 0 ? persist / downFollowed : 0,
    boomProbability: boomYears.length / n,
    maxDownStreak,
    downMean: avg(downYears),
    boomMean: avg(boomYears),
    midMean: avg(midYears),
    downYears,
    boomYears,
    midYears,
  };
}

export const SP500_STATS = computeStats(SP500_ANNUAL_RETURNS);

/** Pick a uniform random element from a non-empty array. */
export function pickOne(pool: readonly number[], rng: () => number): number {
  if (pool.length === 0) return 0;
  return pool[Math.floor(rng() * pool.length)]!;
}
