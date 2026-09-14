import type { AccountType } from './types';
import type { MutableAccount } from './accountOps';
import { isUnitPriced } from './accountOps';

export interface SpendBreakdown {
  general: number;
  travel: number;
  healthInsurance: number;
  total: number;
}

export interface AccountYearSnapshot {
  id: string;
  type: AccountType;
  label: string;
  owner: string;
  balanceUsd: number;
  units: number | null;
  priceUsd: number | null;
  /** Market return applied during this year (not deposits/withdrawals). */
  marketReturn?: number | null;
}

export function emptySpend(): SpendBreakdown {
  return { general: 0, travel: 0, healthInsurance: 0, total: 0 };
}

export function addSpend(spend: SpendBreakdown, category: keyof Omit<SpendBreakdown, 'total'>, amount: number): void {
  if (amount === 0) return;
  spend[category] += amount;
  spend.total += amount;
}

export function scaleSpend(spend: SpendBreakdown, factor: number): SpendBreakdown {
  if (factor === 1) return spend;
  return {
    general: spend.general * factor,
    travel: spend.travel * factor,
    healthInsurance: spend.healthInsurance * factor,
    total: spend.total * factor,
  };
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function roundUnits(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

export function snapshotAccounts(
  accounts: readonly MutableAccount[],
  labels: Record<string, string>,
  marketReturnById?: Record<string, number>
): AccountYearSnapshot[] {
  return accounts.map((acct) => {
    const units =
      acct.assetUnits != null && Number.isFinite(acct.assetUnits) ? roundUnits(acct.assetUnits) : null;
    let priceUsd: number | null = null;
    if (acct.spotPriceUsd != null && acct.spotPriceUsd > 0) {
      priceUsd = roundMoney(acct.spotPriceUsd);
    } else if (isUnitPriced(acct.type) && units != null && units > 0 && acct.balance > 0) {
      priceUsd = roundMoney(acct.balance / units);
    }
    const marketReturn = marketReturnById?.[acct.id];
    return {
      id: acct.id,
      type: acct.type,
      label: labels[acct.id] || acct.type,
      owner: acct.owner,
      balanceUsd: roundMoney(acct.balance),
      units,
      priceUsd,
      ...(marketReturn != null ? { marketReturn } : {}),
    };
  });
}
