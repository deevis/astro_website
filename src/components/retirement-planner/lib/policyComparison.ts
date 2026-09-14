import { projectCashflow, type ProjectionResult } from './cashflow';
import {
  createSimulationRequest,
  simulationMetaFromRequest,
  type SimulationMeta,
} from './simulation';
import type { RetirementPlan } from './types';

export interface PolicyComparisonSide {
  label: string;
  result: ProjectionResult;
  simulationMeta: SimulationMeta;
}

export interface PolicyComparisonResult {
  seed: number;
  baseline: PolicyComparisonSide;
  variant: PolicyComparisonSide;
  deltas: {
    endingBalance: number;
    totalRothConverted: number;
    totalExpenseCuts: number;
    totalCryptoHarvested: number;
    depletedAgeDelta: number | null;
  };
}

export interface PolicyComparisonOptions {
  seed?: number;
  baselineLabel?: string;
  variantLabel?: string;
}

/**
 * Run two plan variants on the same seed for apples-to-apples policy comparison.
 */
export function comparePolicies(
  baselinePlan: RetirementPlan,
  variantPlan: RetirementPlan,
  options: PolicyComparisonOptions = {}
): PolicyComparisonResult {
  const seed = options.seed ?? 42;
  const baselineReq = createSimulationRequest(baselinePlan, { quiet: true, seed });
  const variantReq = createSimulationRequest(variantPlan, { quiet: true, seed });

  const baselineResult = projectCashflow(baselinePlan, { quiet: true, seed });
  const variantResult = projectCashflow(variantPlan, { quiet: true, seed });

  const baselineMeta = simulationMetaFromRequest(baselineReq, seed);
  const variantMeta = simulationMetaFromRequest(variantReq, seed);

  const depletedAgeDelta =
    baselineResult.depletedAge != null && variantResult.depletedAge != null
      ? variantResult.depletedAge - baselineResult.depletedAge
      : null;

  return {
    seed,
    baseline: {
      label: options.baselineLabel ?? 'Baseline',
      result: baselineResult,
      simulationMeta: baselineMeta,
    },
    variant: {
      label: options.variantLabel ?? 'Variant',
      result: variantResult,
      simulationMeta: variantMeta,
    },
    deltas: {
      endingBalance: variantResult.endingBalance - baselineResult.endingBalance,
      totalRothConverted: variantResult.totalRothConverted - baselineResult.totalRothConverted,
      totalExpenseCuts: variantResult.totalExpenseCuts - baselineResult.totalExpenseCuts,
      totalCryptoHarvested:
        variantResult.totalCryptoHarvested - baselineResult.totalCryptoHarvested,
      depletedAgeDelta,
    },
  };
}

/** Convenience: compare current plan vs Roth-off variant on same seed. */
export function compareRothOnOff(
  plan: RetirementPlan,
  seed = 42
): PolicyComparisonResult {
  const variant: RetirementPlan = structuredClone(plan);
  variant.taxStrategy = {
    ...variant.taxStrategy,
    rothConversionPolicy: 'none',
    convertInSsGapYears: false,
  };
  return comparePolicies(plan, variant, {
    seed,
    baselineLabel: 'Roth conversions on',
    variantLabel: 'Roth conversions off',
  });
}
