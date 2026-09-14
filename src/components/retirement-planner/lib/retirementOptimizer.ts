/**
 * Retirement Date Optimizer — sweeps yearly candidate retirement ages,
 * scores each with deterministic projection + light Monte Carlo, and
 * picks earliest-viable / sweet-spot / max-security dates.
 */
import { projectCashflow } from './cashflow';
import { plannedRetirementSpend } from './rampAnalysis';
import { runMonteCarlo } from './monteCarlo';
import { computeSequenceRiskReport, type SequenceRiskReport } from './sequenceRisk';
import {
  createDefaultOptimizerPreferences,
  createDefaultPayrollSavings,
  syncRetirementDerivedFields,
  type OptimizerPreferences,
  type RetirementPlan,
} from './types';

export const OPTIMIZER_MIN_AGE = 55;
export const OPTIMIZER_MAX_AGE = 70;
export const OPTIMIZER_MC_RUNS = 300;
export const OPTIMIZER_MAX_SECURITY_SUCCESS = 0.95;
/** Marginal score gain below this → diminishing returns elbow */
export const SWEET_SPOT_MARGINAL_THRESHOLD = 0.035;

export interface AgeOutcome {
  retirementAge: number;
  successRate: number;
  meetsThreshold: boolean;
  portfolioAtRetirement: number;
  endingBalance: number;
  legacyP50: number;
  legacyP10: number;
  plannedAnnualSpend: number;
  totalContributionsUntilRetirement: number;
  gapInsuranceYears: number;
  yearsOfWorkRemaining: number;
  yearsDeferredFromEarliest: number;
  /** Early-retirement cumulative portfolio return (first years after retiring) */
  earlyRetirementCumulative: number;
  sequenceRiskScore: number;
  /** Preference-weighted utility (higher = better) */
  score: number;
  marginalScoreGain: number;
  sequenceRiskReport: SequenceRiskReport;
  costOfOneMoreYear: {
    contributionsThatYear: number;
    gapInsuranceChange: number;
    yearsDeferred: number;
  };
}

export interface OptimizerPick {
  age: number;
  reason: string;
}

export interface SavingsRelevance {
  withSaving: { retirementAge: number; successRate: number; plannedAnnualSpend: number };
  withoutSaving: { retirementAge: number; successRate: number; plannedAnnualSpend: number };
  deltaRetirementAge: number;
  deltaSuccessRate: number;
  deltaAnnualSpend: number;
  summary: string;
}

export interface OptimizerResult {
  ages: AgeOutcome[];
  earliestViable: OptimizerPick | null;
  sweetSpot: OptimizerPick | null;
  maxSecurity: OptimizerPick | null;
  preferences: OptimizerPreferences;
  successThreshold: number;
  savingsRelevance: SavingsRelevance | null;
  seed: number;
  /** Aggregate sequence-risk readout for the sweet-spot age (if found) */
  sequenceRisk: SequenceRiskReport | null;
  policySweep: PolicySweepResult | null;
}

export interface PolicySweepResult {
  bestBufferYears: number;
  bestBracketCeiling: number;
  weightedScore: number;
  endingBalance: number;
  successRate: number;
}

export interface OptimizerProgress {
  phase: 'deterministic' | 'monteCarlo' | 'savingsRelevance' | 'done';
  completed: number;
  total: number;
  currentAge?: number;
  message: string;
}

function clonePlan(plan: RetirementPlan): RetirementPlan {
  return structuredClone(plan);
}

function withRetirementAge(plan: RetirementPlan, retirementAge: number): RetirementPlan {
  const next = clonePlan(plan);
  next.primary = { ...next.primary, retirementAge };
  return syncRetirementDerivedFields(next);
}

function withoutFuturePayrollSaving(plan: RetirementPlan): RetirementPlan {
  const next = clonePlan(plan);
  next.payrollSavings = createDefaultPayrollSavings();
  // Zero ongoing contributions / employer match while working
  next.accounts = next.accounts.map((a) => {
    if (a.owner !== 'primary') return a;
    if (a.type === 'hysa' || a.type === 'traditional401k' || a.type === 'roth401k') {
      return { ...a, annualContribution: 0, employerMatchAnnual: 0 };
    }
    return a;
  });
  return syncRetirementDerivedFields(next);
}

function candidateAges(plan: RetirementPlan): number[] {
  const start = Math.max(OPTIMIZER_MIN_AGE, Math.ceil(plan.primary.currentAge));
  const end = Math.min(OPTIMIZER_MAX_AGE, plan.primary.lifeExpectancy - 1);
  const ages: number[] = [];
  for (let a = start; a <= end; a++) ages.push(a);
  return ages;
}

function normalizePrefs(prefs: OptimizerPreferences): {
  sooner: number;
  spend: number;
  certainty: number;
  legacy: number;
} {
  const raw = [
    Math.max(0, prefs.retireSooner),
    Math.max(0, prefs.higherSpending),
    Math.max(0, prefs.certainty),
    Math.max(0, prefs.legacy),
  ];
  const sum = raw.reduce((s, n) => s + n, 0) || 1;
  return {
    sooner: raw[0]! / sum,
    spend: raw[1]! / sum,
    certainty: raw[2]! / sum,
    legacy: raw[3]! / sum,
  };
}

function scoreOutcome(
  o: Omit<AgeOutcome, 'score' | 'marginalScoreGain' | 'yearsDeferredFromEarliest'>,
  prefs: OptimizerPreferences,
  earliestViableAge: number | null,
  maxLegacy: number,
  maxSpend: number
): number {
  const w = normalizePrefs(prefs);
  const certainty = Math.min(1, Math.max(0, o.successRate));
  const spendNorm = maxSpend > 0 ? Math.min(1, o.plannedAnnualSpend / maxSpend) : 0;
  const legacyNorm = maxLegacy > 0 ? Math.min(1, Math.max(0, o.legacyP50) / maxLegacy) : 0;
  // Years free: earlier retirement scores higher
  const span = OPTIMIZER_MAX_AGE - OPTIMIZER_MIN_AGE || 1;
  const soonerNorm = 1 - (o.retirementAge - OPTIMIZER_MIN_AGE) / span;

  let score =
    w.certainty * certainty +
    w.spend * spendNorm +
    w.legacy * legacyNorm +
    w.sooner * soonerNorm;

  // Soft penalty for delaying past earliest viable (leisure cost of working longer)
  if (earliestViableAge != null && o.retirementAge > earliestViableAge) {
    const delay = o.retirementAge - earliestViableAge;
    score -= 0.02 * delay * (0.5 + w.sooner);
  }

  // Sequence-risk penalty (higher early-retirement cumulative drawdown / weak p10)
  score -= 0.08 * Math.min(1, o.sequenceRiskScore);

  return score;
}

function pickThree(
  ages: AgeOutcome[],
  threshold: number
): {
  earliestViable: OptimizerPick | null;
  sweetSpot: OptimizerPick | null;
  maxSecurity: OptimizerPick | null;
} {
  const earliest = ages.find((a) => a.meetsThreshold) ?? null;
  const earliestViable: OptimizerPick | null = earliest
    ? {
        age: earliest.retirementAge,
        reason: `First age meeting your ${(threshold * 100).toFixed(0)}% success threshold with planned spending funded.`,
      }
    : null;

  // Sweet spot: elbow — last age where marginal score gain still exceeds threshold,
  // else the max-score age at/after earliest viable.
  let sweet: AgeOutcome | null = null;
  const pool = earliest
    ? ages.filter((a) => a.retirementAge >= earliest.retirementAge)
    : ages;
  if (pool.length) {
    sweet = pool[0]!;
    for (let i = 1; i < pool.length; i++) {
      const cur = pool[i]!;
      const prev = pool[i - 1]!;
      if (cur.marginalScoreGain >= SWEET_SPOT_MARGINAL_THRESHOLD) {
        sweet = cur;
      } else {
        // Diminishing returns kicked in — prefer previous unless current scores higher overall
        sweet = prev.score >= cur.score ? prev : cur;
        break;
      }
    }
    // Also consider global max score in pool
    const best = pool.reduce((a, b) => (b.score > a.score ? b : a));
    if (sweet && best.score > sweet.score + 0.05) sweet = best;
  }

  const sweetSpot: OptimizerPick | null = sweet
    ? {
        age: sweet.retirementAge,
        reason:
          sweet.marginalScoreGain < SWEET_SPOT_MARGINAL_THRESHOLD
            ? `Another year of work adds little security or spending power relative to delaying retirement — diminishing returns set in here.`
            : `Best balance of certainty, spending capacity, legacy, and retiring sooner given your preferences.`,
      }
    : null;

  const highBar = ages.filter((a) => a.successRate >= OPTIMIZER_MAX_SECURITY_SUCCESS);
  let maxAge: AgeOutcome | null = null;
  if (highBar.length) {
    maxAge = highBar.reduce((a, b) => (b.legacyP50 >= a.legacyP50 ? b : a));
  } else if (ages.length) {
    maxAge = ages.reduce((a, b) =>
      b.successRate > a.successRate ||
      (b.successRate === a.successRate && b.legacyP50 > a.legacyP50)
        ? b
        : a
    );
  }
  const maxSecurity: OptimizerPick | null = maxAge
    ? {
        age: maxAge.retirementAge,
        reason:
          maxAge.successRate >= OPTIMIZER_MAX_SECURITY_SUCCESS
            ? `Reaches ~${(maxAge.successRate * 100).toFixed(0)}% success with a stronger ending / legacy cushion.`
            : `Highest success rate in the scanned range (${(maxAge.successRate * 100).toFixed(0)}%).`,
      }
    : null;

  return { earliestViable, sweetSpot, maxSecurity };
}

async function evaluateAge(
  basePlan: RetirementPlan,
  retirementAge: number,
  seed: number
): Promise<Omit<AgeOutcome, 'score' | 'marginalScoreGain' | 'yearsDeferredFromEarliest'>> {
  const plan = withRetirementAge(basePlan, retirementAge);
  const det = projectCashflow(plan, { quiet: true });
  const retYear = det.years.find((y) => y.age === retirementAge);
  const portfolioAtRetirement = retYear?.portfolioTotal ?? det.years[0]?.portfolioTotal ?? 0;

  let totalContributionsUntilRetirement = 0;
  for (const y of det.years) {
    if (y.age < retirementAge) totalContributionsUntilRetirement += y.contributions;
  }

  const gapInsuranceYears = Math.max(
    0,
    Math.min(plan.primary.medicareStartAge, plan.primary.lifeExpectancy) - retirementAge
  );

  const earlyYears = det.years.filter(
    (y) => y.age >= retirementAge && y.age < retirementAge + 5
  );
  const earlyRetirementCumulative =
    earlyYears.reduce((acc, y) => acc * (1 + y.portfolioReturn), 1) - 1;

  const mc = await runMonteCarlo(plan, {
    runs: OPTIMIZER_MC_RUNS,
    seed, // Common random paths make retirement-age comparisons less noisy.
  });

  const sorted = [...mc.endingBalances].sort((a, b) => a - b);
  const p10 = sorted[Math.floor(sorted.length * 0.1)] ?? 0;
  const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? det.endingBalance;

  const plannedAnnualSpend = plannedRetirementSpend(plan);
  const sequenceRiskReport = computeSequenceRiskReport(det, retirementAge);
  const sequenceRiskScore = Math.min(
    1,
    Math.max(0, -earlyRetirementCumulative) * 0.35 +
      sequenceRiskReport.forcedSaleYears * 0.1 +
      (sequenceRiskReport.liquidBufferYearsAtRetirement != null &&
      sequenceRiskReport.liquidBufferYearsAtRetirement < 2
        ? 0.25
        : 0) +
      (portfolioAtRetirement > 0
        ? Math.max(0, 1 - p10 / Math.max(portfolioAtRetirement, 1)) * 0.3
        : 0.15)
  );

  const yearsOfWorkRemaining = Math.max(0, retirementAge - plan.primary.currentAge);

  // Cost of working this year vs retiring one year earlier (approx)
  const prevAge = retirementAge - 1;
  let contributionsThatYear = 0;
  const yearRow = det.years.find((y) => y.age === prevAge);
  if (yearRow) contributionsThatYear = yearRow.contributions;
  const gapAtPrev = Math.max(
    0,
    Math.min(plan.primary.medicareStartAge, plan.primary.lifeExpectancy) - prevAge
  );
  const gapInsuranceChange = (gapInsuranceYears - gapAtPrev) * (plan.taxStrategy.monthlyInsuranceUntilMedicare ?? 0) * 12;

  return {
    retirementAge,
    successRate: mc.successRate,
    meetsThreshold: mc.successRate >= plan.assumptions.successThreshold,
    portfolioAtRetirement,
    endingBalance: det.endingBalance,
    legacyP50: p50,
    legacyP10: p10,
    plannedAnnualSpend,
    totalContributionsUntilRetirement,
    gapInsuranceYears,
    yearsOfWorkRemaining,
    earlyRetirementCumulative,
    sequenceRiskScore,
    sequenceRiskReport,
    costOfOneMoreYear: {
      contributionsThatYear,
      gapInsuranceChange,
      yearsDeferred: 1,
    },
  };
}

/**
 * Multi-objective sweep over policy knobs at a fixed retirement age.
 * Weighted score: success rate, ending balance, runway safety.
 */
export function sweepPolicyParameters(
  plan: RetirementPlan,
  retirementAge: number,
  seed: number
): PolicySweepResult {
  const bufferOptions = [2, 3, 4, 5];
  const bracketOptions = [0.12, 0.22, 0.24];
  let best: PolicySweepResult = {
    bestBufferYears: plan.taxStrategy.athHarvestBufferYears ?? 4,
    bestBracketCeiling: plan.taxStrategy.targetFederalBracketCeiling,
    weightedScore: -Infinity,
    endingBalance: 0,
    successRate: 0,
  };

  for (const bufferYears of bufferOptions) {
    for (const bracket of bracketOptions) {
      const variant = withRetirementAge(plan, retirementAge);
      variant.taxStrategy = {
        ...variant.taxStrategy,
        athHarvestBufferYears: bufferYears,
        liquidBufferTargetYears: Math.min(bufferYears, variant.taxStrategy.liquidBufferTargetYears),
        targetFederalBracketCeiling: bracket,
      };
      const det = projectCashflow(variant, { quiet: true, seed });
      const seq = computeSequenceRiskReport(det, retirementAge);
      const runwayBonus =
        seq.liquidBufferYearsAtRetirement != null && seq.liquidBufferYearsAtRetirement >= 2
          ? 0.1
          : 0;
      const weightedScore =
        det.endingBalance / 1_000_000 +
        (det.failed ? 0 : 0.5) +
        runwayBonus -
        seq.forcedSaleYears * 0.02;
      if (weightedScore > best.weightedScore) {
        best = {
          bestBufferYears: bufferYears,
          bestBracketCeiling: bracket,
          weightedScore,
          endingBalance: det.endingBalance,
          successRate: det.failed ? 0 : 1,
        };
      }
    }
  }
  return best;
}

/**
 * Run the full yearly sweep for the given plan.
 */
export async function runRetirementOptimizer(
  plan: RetirementPlan,
  options: {
    seed?: number;
    includeSavingsRelevance?: boolean;
    onProgress?: (p: OptimizerProgress) => void;
  } = {}
): Promise<OptimizerResult> {
  const seed = options.seed ?? Date.now();
  const prefs = plan.optimizerPreferences ?? createDefaultOptimizerPreferences();
  const threshold = plan.assumptions.successThreshold;
  const agesList = candidateAges(plan);

  if (agesList.length === 0) {
    return {
      ages: [],
      earliestViable: null,
      sweetSpot: null,
      maxSecurity: null,
      preferences: prefs,
      successThreshold: threshold,
      savingsRelevance: null,
      seed,
      sequenceRisk: null,
      policySweep: null,
    };
  }

  const totalMc = agesList.length;
  const raw: Omit<AgeOutcome, 'score' | 'marginalScoreGain' | 'yearsDeferredFromEarliest'>[] = [];

  for (let i = 0; i < agesList.length; i++) {
    const age = agesList[i]!;
    options.onProgress?.({
      phase: 'monteCarlo',
      completed: i,
      total: totalMc + (options.includeSavingsRelevance !== false ? 1 : 0),
      currentAge: age,
      message: `Evaluating retirement at age ${age}…`,
    });
    raw.push(await evaluateAge(plan, age, seed));
  }

  const earliestAge =
    raw.find((a) => a.successRate >= threshold)?.retirementAge ?? null;
  const maxLegacy = Math.max(...raw.map((a) => a.legacyP50), 1);
  const maxSpend = Math.max(...raw.map((a) => a.plannedAnnualSpend), 1);

  const scored: AgeOutcome[] = raw.map((o, idx) => {
    const score = scoreOutcome(o, prefs, earliestAge, maxLegacy, maxSpend);
    const prevScore =
      idx > 0
        ? scoreOutcome(raw[idx - 1]!, prefs, earliestAge, maxLegacy, maxSpend)
        : score;
    return {
      ...o,
      yearsDeferredFromEarliest: earliestAge != null ? Math.max(0, o.retirementAge - earliestAge) : 0,
      score,
      marginalScoreGain: idx === 0 ? score : score - prevScore,
    };
  });

  const picks = pickThree(scored, threshold);

  let savingsRelevance: SavingsRelevance | null = null;
  if (options.includeSavingsRelevance !== false && picks.sweetSpot) {
    options.onProgress?.({
      phase: 'savingsRelevance',
      completed: totalMc,
      total: totalMc + 1,
      message: 'Testing what continued saving buys…',
    });
    const sweetAge = picks.sweetSpot.age;
    const withSave = scored.find((a) => a.retirementAge === sweetAge)!;
    const stripped = withoutFuturePayrollSaving(plan);
    const without = await evaluateAge(stripped, sweetAge, seed);

    savingsRelevance = {
      withSaving: {
        retirementAge: withSave.retirementAge,
        successRate: withSave.successRate,
        plannedAnnualSpend: withSave.plannedAnnualSpend,
      },
      withoutSaving: {
        retirementAge: sweetAge,
        successRate: without.successRate,
        plannedAnnualSpend: without.plannedAnnualSpend,
      },
      deltaRetirementAge: 0,
      deltaSuccessRate: withSave.successRate - without.successRate,
      deltaAnnualSpend: withSave.plannedAnnualSpend - without.plannedAnnualSpend,
      summary:
        withSave.successRate - without.successRate > 0.02
          ? `At age ${sweetAge}, continued HYSA / 401(k) saving lifts success by about ${((withSave.successRate - without.successRate) * 100).toFixed(0)} percentage points versus stopping contributions now.`
          : `At your sweet-spot age (${sweetAge}), stopping future contributions barely changes the outcome — balances and returns already carry most of the plan.`,
    };
  }

  options.onProgress?.({
    phase: 'done',
    completed: totalMc + 1,
    total: totalMc + 1,
    message: 'Optimizer complete',
  });

  const sweetAge = picks.sweetSpot?.age ?? picks.earliestViable?.age ?? agesList[0]!;
  const sequenceRisk =
    scored.find((a) => a.retirementAge === sweetAge)?.sequenceRiskReport ?? null;
  const policySweep = sweepPolicyParameters(plan, sweetAge, seed);

  return {
    ages: scored,
    earliestViable: picks.earliestViable,
    sweetSpot: picks.sweetSpot,
    maxSecurity: picks.maxSecurity,
    preferences: prefs,
    successThreshold: threshold,
    savingsRelevance,
    seed,
    sequenceRisk,
    policySweep,
  };
}
