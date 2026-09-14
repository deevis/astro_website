/**
 * Bitcoin halving-cycle phases for Monte Carlo.
 *
 * Halving calendar (planning anchors):
 *   • 2016-06-01, 2020-05-01, 2024-04-01, next 2028-03-01
 *
 * Cycle rhythm:
 *   • New ATH formation often starts ~10 months post-halving (e.g. Jan 2029 after Mar 2028)
 *   • ATH peak zone ~74 weeks after halving
 *   • Bear-market low ~74 weeks before the next halving
 *
 * Yields ~1 bear year in 4 on calendar boundaries.
 */

/** Weeks from halving when new ATH breaks typically begin (e.g. 2029-01-01 after 2028-03-01 halving). */
export const ATH_FORMATION_START_WEEKS = 44;
/** Weeks from halving to ATH peak zone; bull → bear transition. */
export const ATH_WEEKS_AFTER_HALVING = 74;
export const BOTTOM_WEEKS_BEFORE_HALVING = 74;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** Halving dates used for cycle bracketing (UTC noon). */
const KNOWN_HALVING_MS = [
  Date.parse('2012-11-28T12:00:00Z'),
  Date.parse('2016-06-01T12:00:00Z'),
  Date.parse('2020-05-01T12:00:00Z'),
  Date.parse('2024-04-01T12:00:00Z'),
  Date.parse('2028-03-01T12:00:00Z'),
];

export type BitcoinHalvingPhase = 'postHalvingBull' | 'postAthBear' | 'preHalvingRecovery';

export interface HalvingCyclePosition {
  phase: BitcoinHalvingPhase;
  weeksSinceHalving: number;
  weeksToNextHalving: number;
  /** 0 at last halving → 1 at next halving */
  cycleProgress: number;
}

function bracketHalving(ts: number): { lastMs: number; nextMs: number } {
  if (ts < KNOWN_HALVING_MS[0]) {
    const interval = KNOWN_HALVING_MS[1] - KNOWN_HALVING_MS[0];
    return { lastMs: KNOWN_HALVING_MS[0] - interval, nextMs: KNOWN_HALVING_MS[0] };
  }

  for (let i = 0; i < KNOWN_HALVING_MS.length - 1; i++) {
    const last = KNOWN_HALVING_MS[i];
    const next = KNOWN_HALVING_MS[i + 1];
    if (ts >= last && ts < next) return { lastMs: last, nextMs: next };
  }

  const interval =
    KNOWN_HALVING_MS[KNOWN_HALVING_MS.length - 1] - KNOWN_HALVING_MS[KNOWN_HALVING_MS.length - 2];
  let lastMs = KNOWN_HALVING_MS[KNOWN_HALVING_MS.length - 1];
  let nextMs = lastMs + interval;
  while (ts >= nextMs) {
    lastMs = nextMs;
    nextMs += interval;
  }
  return { lastMs, nextMs };
}

export function getHalvingCyclePosition(date: Date): HalvingCyclePosition {
  const ts = date.getTime();
  const { lastMs, nextMs } = bracketHalving(ts);
  const cycleMs = Math.max(nextMs - lastMs, MS_PER_WEEK);
  const weeksSinceHalving = (ts - lastMs) / MS_PER_WEEK;
  const weeksToNextHalving = (nextMs - ts) / MS_PER_WEEK;
  const cycleProgress = Math.min(1, Math.max(0, (ts - lastMs) / cycleMs));

  let phase: BitcoinHalvingPhase;
  if (weeksSinceHalving < ATH_WEEKS_AFTER_HALVING) {
    phase = 'postHalvingBull';
  } else if (weeksToNextHalving > BOTTOM_WEEKS_BEFORE_HALVING) {
    phase = 'postAthBear';
  } else {
    phase = 'preHalvingRecovery';
  }

  return { phase, weeksSinceHalving, weeksToNextHalving, cycleProgress };
}

/** Structural mean return bias by halving phase (before idiosyncratic noise). */
export function halvingPhaseMeanReturn(
  phase: BitcoinHalvingPhase,
  weeksSinceHalving = 0
): number {
  switch (phase) {
    case 'postHalvingBull':
      // Early grind post-halving, then ATH formation (e.g. Jan 2029 after Mar 2028 halving).
      if (weeksSinceHalving >= ATH_FORMATION_START_WEEKS) return 0.52;
      return 0.22;
    case 'postAthBear':
      return -0.32;
    case 'preHalvingRecovery':
      return 0.14;
  }
}

/** Volatility multiplier — bears are choppier; late-cycle recovery is calmer. */
export function halvingPhaseVolMultiplier(
  phase: BitcoinHalvingPhase,
  weeksSinceHalving = 0
): number {
  switch (phase) {
    case 'postHalvingBull':
      return weeksSinceHalving >= ATH_FORMATION_START_WEEKS ? 1.15 : 1.0;
    case 'postAthBear':
      return 1.35;
    case 'preHalvingRecovery':
      return 0.9;
  }
}

/**
 * Compress extreme downside (diminishing marginal losses) while keeping a hard floor.
 * Mirrors how BTC/crypto bears often find support before repeating full drawdowns.
 */
export function dampenDownsideReturn(r: number, softFloor: number, hardFloor: number): number {
  if (r >= softFloor) return Math.max(hardFloor, r);
  const excess = softFloor - r;
  return Math.max(hardFloor, softFloor - excess * 0.38);
}
