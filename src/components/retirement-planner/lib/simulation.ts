import type { RetirementPlan } from './types';
import { amalgamMixId } from './bitcoinPricingModels';

/** Engine semver for reproducibility metadata. */
export const ENGINE_VERSION = '2.1.0';
export const TAX_LAW_PACK_ID = 'federal-2026-v1';
export const POLICY_PACK_ID = 'default-v4';

export interface SimulationRequest {
  plan: RetirementPlan;
  seed?: number;
  /** Monte Carlo run count; 1 = deterministic single path */
  runs?: number;
  quiet?: boolean;
  engineVersion: typeof ENGINE_VERSION;
  taxLawPackId: typeof TAX_LAW_PACK_ID;
  policyPackId: typeof POLICY_PACK_ID;
  marketModelId: string;
  createdAt: string;
}

export interface SimulationMeta {
  seed: number;
  engineVersion: string;
  taxLawPackId: string;
  policyPackId: string;
  marketModelId: string;
  planUpdatedAt: string;
  planName: string;
  runs: number;
}

export function createSimulationRequest(
  plan: RetirementPlan,
  options: { seed?: number; runs?: number; quiet?: boolean } = {}
): SimulationRequest {
  const frozen = structuredClone(plan);
  return {
    plan: frozen,
    seed: options.seed,
    runs: options.runs ?? 1,
    quiet: options.quiet ?? false,
    engineVersion: ENGINE_VERSION,
    taxLawPackId: TAX_LAW_PACK_ID,
    policyPackId: POLICY_PACK_ID,
    marketModelId:
      frozen.assumptions.bitcoinPricingModel === 'amalgam'
        ? amalgamMixId(frozen.assumptions.bitcoinAmalgamMix)
        : (frozen.assumptions.bitcoinPricingModel ?? 'amalgam'),
    createdAt: new Date().toISOString(),
  };
}

export function simulationMetaFromRequest(req: SimulationRequest, seed: number): SimulationMeta {
  return {
    seed,
    engineVersion: req.engineVersion,
    taxLawPackId: req.taxLawPackId,
    policyPackId: req.policyPackId,
    marketModelId: req.marketModelId,
    planUpdatedAt: req.plan.updatedAt,
    planName: req.plan.name,
    runs: req.runs ?? 1,
  };
}
