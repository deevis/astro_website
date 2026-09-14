import { estimateSaleTax } from './capitalGainsTax';
import { contributeToAccount, sellAltProceeds, type MutableAccount } from './accountOps';
import {
  ACCOUNT_TYPE_DEFAULT_RETURNS,
  ACCOUNT_TYPE_LABELS,
  newId,
  type Account,
  type RetirementPlan,
} from './types';

export interface BitcoinLiquidationSummary {
  gross: number;
  tax: number;
  net: number;
  gain: number;
  toHysa: number;
  toBrokerage: number;
  unitsSold: number;
}

function ordinaryIncomeProxy(plan: RetirementPlan): number {
  const age = plan.primary.currentAge;
  let total = 0;
  for (const stream of plan.income) {
    const streamAge =
      stream.owner === 'spouse' && plan.spouse ? plan.spouse.currentAge : age;
    if (streamAge < stream.startAge) continue;
    if (stream.endAge != null && streamAge > stream.endAge) continue;
    if (stream.taxable === false) continue;
    total += Math.max(0, stream.annualAmount);
  }
  return total;
}

function ensureDestination(
  plan: RetirementPlan,
  accounts: Account[],
  type: 'hysa' | 'brokerage'
): Account {
  const existing =
    accounts.find((a) => a.type === type && a.owner === 'primary') ??
    accounts.find((a) => a.type === type);
  if (existing) return existing;
  const created: Account = {
    id: newId(type),
    type,
    label: ACCOUNT_TYPE_LABELS[type],
    owner: 'primary',
    balance: 0,
    annualContribution: 0,
    expectedReturn:
      type === 'hysa' ? plan.assumptions.cashReturn : ACCOUNT_TYPE_DEFAULT_RETURNS.brokerage,
    ...(type === 'brokerage' ? { costBasisUsd: 0 } : {}),
  };
  accounts.push(created);
  return created;
}

function applyBitcoinLiquidation(
  plan: RetirementPlan,
  hysaFraction: number
): BitcoinLiquidationSummary {
  const fraction = Math.min(1, Math.max(0, Number.isFinite(hysaFraction) ? hysaFraction : 1));
  const filing = plan.filingStatus === 'married' ? 'married' : 'single';
  let taxableIncome = ordinaryIncomeProxy(plan);
  let totalGross = 0;
  let totalTax = 0;
  let totalGain = 0;
  let unitsSold = 0;

  const accounts = plan.accounts.map((a) => ({ ...a }));
  for (const acct of accounts) {
    if (acct.type !== 'bitcoin' || acct.balance <= 0) continue;
    const gross = acct.balance;
    const est = estimateSaleTax({
      proceeds: gross,
      balanceBefore: gross,
      costBasisUsd: acct.costBasisUsd ?? 0,
      type: 'bitcoin',
      filing,
      taxableIncome,
    });
    taxableIncome += est.gain;
    const sold = sellAltProceeds(acct as MutableAccount, gross);
    acct.balance = 0;
    acct.assetUnits = 0;
    acct.costBasisUsd = 0;
    totalGross += gross;
    totalTax += est.tax;
    totalGain += est.gain;
    unitsSold += sold.unitsSold;
  }

  const net = Math.max(0, totalGross - totalTax);
  const toHysa = net * fraction;
  const toBrokerage = net - toHysa;

  if (toHysa > 0) {
    ensureDestination(plan, accounts, 'hysa').balance += toHysa;
  }
  if (toBrokerage > 0) {
    contributeToAccount(ensureDestination(plan, accounts, 'brokerage') as MutableAccount, toBrokerage);
  }

  plan.accounts = accounts;
  return {
    gross: totalGross,
    tax: totalTax,
    net,
    gain: totalGain,
    toHysa,
    toBrokerage,
    unitsSold,
  };
}

export function bitcoinHoldingsUsd(plan: Pick<RetirementPlan, 'accounts'>): {
  usd: number;
  btc: number | null;
} {
  let usd = 0;
  let btc = 0;
  let tracked = false;
  for (const acct of plan.accounts) {
    if (acct.type !== 'bitcoin') continue;
    usd += Math.max(0, acct.balance);
    if (acct.assetUnits != null && acct.assetUnits > 0) {
      btc += acct.assetUnits;
      tracked = true;
    }
  }
  return { usd, btc: tracked ? btc : null };
}

/** Preview proceeds without mutating the plan. */
export function previewBitcoinLiquidation(
  plan: RetirementPlan,
  hysaFraction: number
): BitcoinLiquidationSummary {
  return applyBitcoinLiquidation(structuredClone(plan), hysaFraction);
}

/**
 * Sell every Bitcoin sleeve now and park net proceeds (after estimated federal
 * LTCG) in HYSA and/or taxable brokerage. Returns a cloned plan.
 */
export function liquidateBitcoinToCash(
  plan: RetirementPlan,
  hysaFraction: number
): { plan: RetirementPlan; summary: BitcoinLiquidationSummary } {
  const next = structuredClone(plan);
  const summary = applyBitcoinLiquidation(next, hysaFraction);
  return { plan: next, summary };
}
