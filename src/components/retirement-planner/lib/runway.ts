import type { Account, AccountType, RetirementPlan } from './types';

/** Stable spending reserves — ATH harvest fills these, not Bitcoin. */
const CASH_LIKE_TYPES = new Set<AccountType>(['hysa', 'cd', 'bond']);

type BalanceAccount = Pick<Account, 'type' | 'balance'>;

export interface RunwayOptions {
  /**
   * Include Bitcoin in liquid USD. RAMP uses this (BTC is highly marketable).
   * ATH harvest leaves it off so a large BTC sleeve does not look like a filled cash buffer.
   */
  includeBitcoin?: boolean;
}

export interface RunwaySnapshot {
  liquidUsd: number;
  cashLikeUsd: number;
  bitcoinUsd: number;
  essentialSpendAnnual: number;
  totalSpendAnnual: number;
  essentialMonths: number;
  totalMonths: number;
  bufferYears: number;
  minTargetYears: number;
  preferredTargetYears: number;
  maxTargetYears: number;
  gapToPreferredUsd: number;
  belowMinimum: boolean;
}

function isLiquidType(type: AccountType, includeBitcoin: boolean): boolean {
  if (CASH_LIKE_TYPES.has(type)) return true;
  return includeBitcoin && type === 'bitcoin';
}

export function liquidBalanceUsd(
  accounts: readonly BalanceAccount[],
  options: RunwayOptions = {}
): number {
  const includeBitcoin = options.includeBitcoin === true;
  return accounts
    .filter((a) => isLiquidType(a.type, includeBitcoin))
    .reduce((s, a) => s + Math.max(0, a.balance), 0);
}

/**
 * Runway in months/years of spending covered by liquid reserves.
 * Default is HYSA + CD + bonds; pass includeBitcoin for RAMP-style market liquidity.
 */
export function computeRunway(
  plan: RetirementPlan,
  accounts: readonly BalanceAccount[],
  totalSpendAnnual: number,
  essentialSpendAnnual?: number,
  options: RunwayOptions = {}
): RunwaySnapshot {
  const includeBitcoin = options.includeBitcoin === true;
  const cashLikeUsd = accounts
    .filter((a) => CASH_LIKE_TYPES.has(a.type))
    .reduce((s, a) => s + Math.max(0, a.balance), 0);
  const bitcoinUsd = accounts
    .filter((a) => a.type === 'bitcoin')
    .reduce((s, a) => s + Math.max(0, a.balance), 0);
  const liquidUsd = includeBitcoin ? cashLikeUsd + bitcoinUsd : cashLikeUsd;
  const essential = essentialSpendAnnual ?? totalSpendAnnual;
  const minTargetYears = Math.max(0, plan.taxStrategy.liquidBufferTargetYears ?? 2);
  const preferredTargetYears = Math.max(
    minTargetYears,
    plan.taxStrategy.athHarvestBufferYears ?? 4
  );
  const maxTargetYears = preferredTargetYears + 1;
  const essentialMonths = essential > 0 ? (liquidUsd / essential) * 12 : 999;
  const totalMonths = totalSpendAnnual > 0 ? (liquidUsd / totalSpendAnnual) * 12 : 999;
  const bufferYears = totalSpendAnnual > 0 ? liquidUsd / totalSpendAnnual : 999;
  const gapToPreferredUsd = Math.max(0, totalSpendAnnual * preferredTargetYears - liquidUsd);

  return {
    liquidUsd,
    cashLikeUsd,
    bitcoinUsd,
    essentialSpendAnnual: essential,
    totalSpendAnnual,
    essentialMonths,
    totalMonths,
    bufferYears,
    minTargetYears,
    preferredTargetYears,
    maxTargetYears,
    gapToPreferredUsd,
    belowMinimum: bufferYears < minTargetYears,
  };
}
