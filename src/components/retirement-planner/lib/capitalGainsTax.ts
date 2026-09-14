import type { AccountType } from './types';

import { LTCG_TOPS_SINGLE, LTCG_TOPS_MFJ } from './taxBrackets';

/**
 * Federal long-term capital gains rate (0 / 15 / 20%) from taxable-income proxy.
 * Planning approximation — not a full tax engine.
 */
export function ltcgFederalRate(
  filing: 'single' | 'married',
  taxableIncome: number
): number {
  const tops = filing === 'married' ? LTCG_TOPS_MFJ : LTCG_TOPS_SINGLE;
  if (taxableIncome <= tops[0]) return 0;
  if (taxableIncome <= tops[1]) return 0.15;
  return 0.2;
}

/** Stack gains above ordinary taxable income, without a tax cliff on the entire sale. */
export function longTermCapitalGainsTax(filing: 'single' | 'married', ordinaryTaxable: number, gains: number, inflationFactor = 1): number {
  const tops = (filing === 'married' ? LTCG_TOPS_MFJ : LTCG_TOPS_SINGLE).map((top) => top * inflationFactor);
  const start = Math.max(0, ordinaryTaxable);
  const end = start + Math.max(0, gains);
  const at15 = Math.max(0, Math.min(end, tops[1]) - Math.max(start, tops[0]));
  const at20 = Math.max(0, end - Math.max(start, tops[1]));
  return at15 * 0.15 + at20 * 0.20;
}

/** Collectibles (physical gold/silver) — capped at 28% federal. */
export function collectiblesFederalRate(): number {
  return 0.28;
}

export function capitalGainsRateForAccount(
  type: AccountType,
  filing: 'single' | 'married',
  taxableIncome: number
): number {
  if (type === 'gold' || type === 'silver') return collectiblesFederalRate();
  if (type === 'bitcoin' || type === 'crypto') return ltcgFederalRate(filing, taxableIncome);
  return ltcgFederalRate(filing, taxableIncome);
}

/**
 * Estimate tax on a sale given proceeds, remaining balance, and total basis.
 * Basis is reduced proportionally to the fraction sold.
 */
export function estimateSaleTax(params: {
  proceeds: number;
  balanceBefore: number;
  costBasisUsd: number;
  type: AccountType;
  filing: 'single' | 'married';
  taxableIncome: number;
}): { gain: number; tax: number; net: number; basisSold: number } {
  const { proceeds, balanceBefore, costBasisUsd, type, filing, taxableIncome } = params;
  if (proceeds <= 0 || balanceBefore <= 0) {
    return { gain: 0, tax: 0, net: proceeds, basisSold: 0 };
  }
  const fraction = Math.min(1, proceeds / balanceBefore);
  const basisSold = Math.min(costBasisUsd, costBasisUsd * fraction);
  const gain = Math.max(0, proceeds - basisSold);
  const tax = type === 'gold' || type === 'silver' ? gain * collectiblesFederalRate() : longTermCapitalGainsTax(filing, taxableIncome, gain);
  return { gain, tax, net: proceeds - tax, basisSold };
}

/**
 * Gross proceeds needed so that after estimated CG tax, net equals targetNet.
 */
export function grossForTargetNet(params: {
  targetNet: number;
  balance: number;
  costBasisUsd: number;
  type: AccountType;
  filing: 'single' | 'married';
  taxableIncome: number;
  maxGross: number;
}): number {
  const { targetNet, balance, costBasisUsd, type, filing, taxableIncome, maxGross } = params;
  if (targetNet <= 0 || balance <= 0) return 0;
  let lo = 0;
  let hi = Math.min(maxGross, balance);
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const { net } = estimateSaleTax({
      proceeds: mid,
      balanceBefore: balance,
      costBasisUsd,
      type,
      filing,
      taxableIncome,
    });
    if (net < targetNet) lo = mid;
    else hi = mid;
  }
  return hi;
}
