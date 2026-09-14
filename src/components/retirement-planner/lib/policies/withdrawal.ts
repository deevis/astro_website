import type { AccountType } from '../types';

export const POLICY_IDS = {
  withdrawal: 'withdrawal-policy',
  spendingAdjustment: 'spending-adjustment-policy',
  athHarvest: 'ath-harvest-policy',
  altTrim: 'alt-trim-policy',
  rothConversion: 'roth-conversion-policy',
  rmd: 'rmd-policy',
} as const;

/** Withdrawal order — down-year + favor-cash delays brokerage and risk assets. */
export function spendingWithdrawalOrder(
  downYear: boolean,
  favorCash: boolean
): AccountType[] {
  if (downYear && favorCash) {
    return [
      'hysa',
      'cd',
      'bond',
      'traditionalIra',
      'traditional401k',
      'rothIra',
      'roth401k',
      'brokerage',
      'gold',
      'silver',
      'crypto',
      'bitcoin',
    ];
  }
  return [
    'hysa',
    'cd',
    'bond',
    'brokerage',
    'gold',
    'silver',
    'traditionalIra',
    'traditional401k',
    'rothIra',
    'roth401k',
    'crypto',
    'bitcoin',
  ];
}

export function applySpendingCut(
  expenses: number,
  downYear: boolean,
  cutFraction: number
): { expenses: number; cut: number } {
  if (!downYear || cutFraction <= 0 || expenses <= 0) {
    return { expenses, cut: 0 };
  }
  const cut = expenses * cutFraction;
  return { expenses: expenses - cut, cut };
}
