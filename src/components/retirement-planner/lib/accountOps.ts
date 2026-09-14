import type { Account, AccountType } from './types';

export interface MutableAccount {
  id: string;
  type: AccountType;
  owner: Account['owner'];
  balance: number;
  annualContribution: number;
  expectedReturn: number;
  assetUnits?: number;
  spotPriceUsd?: number;
  costBasisUsd?: number;
  employerMatchAnnual?: number;
}

export function isUnitPriced(type: AccountType): boolean {
  return type === 'bitcoin' || type === 'gold' || type === 'silver';
}

export function syncUnitBalance(acct: MutableAccount) {
  if (acct.assetUnits != null && acct.spotPriceUsd != null && acct.spotPriceUsd > 0) {
    acct.balance = Math.max(0, acct.assetUnits * acct.spotPriceUsd);
  }
}

/** Buy units at the current price; taxable contributions also increase cost basis. */
export function contributeToAccount(acct: MutableAccount, amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) return;
  if (isUnitPriced(acct.type) && acct.spotPriceUsd != null && acct.spotPriceUsd > 0) {
    acct.assetUnits = (acct.assetUnits ?? acct.balance / acct.spotPriceUsd) + amount / acct.spotPriceUsd;
  }
  acct.balance += amount;
  if (isUnitPriced(acct.type) || acct.type === 'crypto' || acct.type === 'brokerage') {
    acct.costBasisUsd = (acct.costBasisUsd ?? 0) + amount;
  }
}

export function sumByType(accounts: MutableAccount[], type: AccountType): number {
  return accounts.filter((a) => a.type === type).reduce((s, a) => s + a.balance, 0);
}

export function withdrawFrom(
  accounts: MutableAccount[],
  typesInOrder: AccountType[],
  amount: number,
  ownerFilter?: (a: MutableAccount) => boolean
): number {
  let remaining = amount;
  for (const type of typesInOrder) {
    if (remaining <= 0) break;
    const pool = accounts.filter(
      (a) => a.type === type && a.balance > 0 && (!ownerFilter || ownerFilter(a))
    );
    for (const acct of pool) {
      if (remaining <= 0) break;
      const actual = Math.min(acct.balance, remaining);
      applyWithdrawal(acct, actual);
      remaining -= actual;
    }
  }
  return amount - remaining;
}

export function sellAltProceeds(
  acct: MutableAccount,
  gross: number
): { unitsSold: number; price: number | null } {
  if (gross <= 0) return { unitsSold: 0, price: null };
  const actual = Math.min(acct.balance, gross);
  let unitsSold = 0;
  let price: number | null = null;

  if (isUnitPriced(acct.type)) {
    price =
      acct.spotPriceUsd != null && acct.spotPriceUsd > 0
        ? acct.spotPriceUsd
        : acct.assetUnits != null && acct.assetUnits > 0
          ? acct.balance / acct.assetUnits
          : null;
    if (price != null && price > 0 && acct.assetUnits != null) {
      unitsSold = actual / price;
      acct.assetUnits = Math.max(0, acct.assetUnits - unitsSold);
    }
    acct.balance -= actual;
    syncUnitBalance(acct);
  } else {
    acct.balance -= actual;
  }

  return { unitsSold, price };
}

export function withdrawRmdFromTraditional(
  accounts: MutableAccount[],
  owner: 'primary' | 'spouse',
  amount: number
): number {
  return withdrawFrom(
    accounts,
    ['traditionalIra', 'traditional401k'],
    amount,
    (a) => a.owner === owner || a.owner === 'joint'
  );
}

export interface WithdrawalDetail {
  accountId: string;
  accountType: AccountType;
  amount: number;
  /** Realized capital gain when selling from a taxable brokerage account */
  realizedGain?: number;
}

function applyWithdrawal(acct: MutableAccount, actual: number): number {
  let realizedGain = 0;
  if ((acct.type === 'brokerage' || acct.type === 'crypto' || isUnitPriced(acct.type)) && acct.balance > 0 && actual > 0) {
    const basis = acct.costBasisUsd ?? 0;
    const basisRatio = Math.min(1, basis / acct.balance);
    realizedGain = actual * (1 - basisRatio);
    acct.costBasisUsd = Math.max(0, basis - actual * basisRatio);
  }

  if (isUnitPriced(acct.type)) {
    const price =
      acct.spotPriceUsd != null && acct.spotPriceUsd > 0
        ? acct.spotPriceUsd
        : acct.assetUnits != null && acct.assetUnits > 0
          ? acct.balance / acct.assetUnits
          : null;
    if (price != null && price > 0 && acct.assetUnits != null) {
      acct.assetUnits = Math.max(0, acct.assetUnits - actual / price);
      syncUnitBalance(acct);
    } else {
      acct.balance -= actual;
    }
  } else {
    acct.balance -= actual;
  }

  return realizedGain;
}

/** Withdraw following type order; returns per-account breakdown with brokerage gains. */
export function withdrawWithDetail(
  accounts: MutableAccount[],
  typesInOrder: AccountType[],
  amount: number,
  ownerFilter?: (a: MutableAccount) => boolean
): { total: number; details: WithdrawalDetail[] } {
  let remaining = amount;
  const details: WithdrawalDetail[] = [];

  for (const type of typesInOrder) {
    if (remaining <= 0) break;
    const pool = accounts.filter(
      (a) => a.type === type && a.balance > 0 && (!ownerFilter || ownerFilter(a))
    );
    for (const acct of pool) {
      if (remaining <= 0) break;
      const actual = Math.min(acct.balance, remaining);
      const realizedGain = applyWithdrawal(acct, actual);
      remaining -= actual;
      details.push({
        accountId: acct.id,
        accountType: acct.type,
        amount: actual,
        realizedGain: realizedGain > 0 ? realizedGain : undefined,
      });
    }
  }

  return { total: amount - remaining, details };
}
