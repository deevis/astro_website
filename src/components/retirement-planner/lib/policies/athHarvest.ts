import type { AccountType, RetirementPlan } from '../types';
import { DEFAULT_BITCOIN_HISTORICAL_ATH_USD, athHarvestPolicyEnabled, healthPremiumsAtAge } from '../types';
import { estimateSaleTax, grossForTargetNet } from '../tax/federalTaxEngine';
import type { MutableAccount } from '../accountOps';
import { sellAltProceeds } from '../accountOps';
import { computeRunway } from '../runway';
import { primaryClaimAge } from './rothConversion';

export interface AthHarvestResult {
  totalNet: number;
  totalGross: number;
  totalTax: number;
  totalGain: number;
  athHarvest: boolean;
  bitcoinUsd: number;
  bitcoinBtc: number | null;
  bitcoinPrice: number | null;
  cryptoUsd: number;
  goldUsd: number;
  silverUsd: number;
  sales: AthHarvestSaleDetail[];
}

export interface AthHarvestSaleDetail {
  accountId: string;
  accountType: AccountType;
  gross: number;
  gain: number;
  tax: number;
  net: number;
  unitsSold: number;
  price: number | null;
  reason: string;
}

function isAltHarvestType(type: AccountType): boolean {
  return type === 'bitcoin' || type === 'crypto' || type === 'gold' || type === 'silver';
}

function isUnitPriced(type: AccountType): boolean {
  return type === 'bitcoin' || type === 'gold' || type === 'silver';
}

export function initialAltHighWaterMark(plan: RetirementPlan, acct: { type: AccountType; spotPriceUsd?: number; balance: number }): number {
  if (acct.type === 'bitcoin') {
    const spot = acct.spotPriceUsd ?? 0;
    // A dollar balance alone cannot be compared with a BTC/USD market high.
    if (spot <= 0) return 0;
    const historicalAth =
      plan.assumptions.bitcoinHistoricalAthUsd ?? DEFAULT_BITCOIN_HISTORICAL_ATH_USD;
    return Math.max(spot, historicalAth);
  }
  if (isUnitPriced(acct.type) && acct.spotPriceUsd != null && acct.spotPriceUsd > 0) {
    return acct.spotPriceUsd;
  }
  if (acct.balance > 0) return 1;
  return 0;
}

export function accountPriceIndex(
  acct: MutableAccount,
  priceIndexByAccountId: Record<string, number>
): number {
  if (isUnitPriced(acct.type) && acct.spotPriceUsd != null && acct.spotPriceUsd > 0) {
    return acct.spotPriceUsd;
  }
  if (acct.type === 'bitcoin') return 0; // A balance-only account has no BTC/USD quote to compare with ATH.
  return priceIndexByAccountId[acct.id] ?? 0;
}

export function updateAltHighWaterMarks(
  accounts: MutableAccount[],
  hwmByAccountId: Record<string, number>,
  cryptoRefBalance: Record<string, number>
) {
  for (const acct of accounts) {
    if (!isAltHarvestType(acct.type)) continue;
    const priceIdx = accountPriceIndex(acct, cryptoRefBalance);
    if (priceIdx <= 0) continue;
    const hwm = hwmByAccountId[acct.id];
    if (hwm != null && priceIdx > hwm) hwmByAccountId[acct.id] = priceIdx;
  }
}

function inflate(amount: number, rate: number, years: number): number {
  return amount * Math.pow(1 + rate, years);
}

function retirementSpendToday(plan: RetirementPlan): number {
  let total = 0;
  if (!plan.assumptions.useSpendFromPlan || plan.expenses.length === 0) {
    const start = plan.accounts.reduce((s, a) => s + a.balance, 0);
    total = start * plan.assumptions.withdrawalRate;
  } else {
    for (const e of plan.expenses) {
      const amt = e.retirementAnnualAmount != null ? e.retirementAnnualAmount : e.annualAmount;
      total += Math.max(0, amt);
    }
  }
  return total;
}

export function harvestAthAltsToCash(
  plan: RetirementPlan,
  accounts: MutableAccount[],
  age: number,
  yearIndex: number,
  inflation: number,
  hwmByAccountId: Record<string, number>,
  cryptoRefBalance: Record<string, number>,
  taxableIncomeProxy: number,
  annualSpending?: number
): AthHarvestResult {
  const empty: AthHarvestResult = {
    totalNet: 0,
    totalGross: 0,
    totalTax: 0,
    totalGain: 0,
    athHarvest: false,
    bitcoinUsd: 0,
    bitcoinBtc: null,
    bitcoinPrice: null,
    cryptoUsd: 0,
    goldUsd: 0,
    silverUsd: 0,
    sales: [],
  };

  if (plan.taxStrategy.athHarvestEnabled === false) return empty;
  if (!athHarvestPolicyEnabled(plan)) return empty;
  if (age < plan.primary.retirementAge) return empty;
  if (plan.taxStrategy.athHarvestWindow !== 'retirement' && age >= primaryClaimAge(plan)) return empty;

  const maxFraction = Math.min(
    1,
    Math.max(0, plan.taxStrategy.athHarvestMaxSleeveFraction ?? 0.16)
  );
  if (maxFraction <= 0) return empty;

  const spendAnnual = annualSpending ?? inflate(
    retirementSpendToday(plan) + healthPremiumsAtAge(plan, age).dueTotal,
    inflation,
    yearIndex
  );
  const runway = computeRunway(plan, accounts, spendAnnual);
  // The harvest target is independent of the RAMP minimum-buffer preference.
  const targetYears = Math.max(0, plan.taxStrategy.athHarvestBufferYears ?? 4);
  if (runway.bufferYears >= targetYears) return empty;

  let gapNet = Math.max(0, spendAnnual * targetYears - runway.liquidUsd);
  if (gapNet < 1) return empty;

  const filing = plan.filingStatus === 'married' ? 'married' : 'single';
  const altOrder: AccountType[] = ['bitcoin', 'gold', 'silver', 'crypto'];
  const sales: AthHarvestSaleDetail[] = [];

  let bitcoinUsd = 0;
  let bitcoinBtc = 0;
  let trackedBtc = false;
  let bitcoinPrice: number | null = null;
  let cryptoUsd = 0;
  let goldUsd = 0;
  let silverUsd = 0;
  let totalGross = 0;
  let totalTax = 0;
  let totalGain = 0;
  let athHarvest = false;
  const nearAthFraction = Math.min(1, Math.max(0, plan.taxStrategy.athHarvestNearAthFraction ?? 0.05));

  for (const type of altOrder) {
    if (gapNet < 1) break;
    for (const acct of accounts.filter((a) => a.type === type && a.balance > 0)) {
      if (gapNet < 1) break;
      const priceIdx = accountPriceIndex(acct, cryptoRefBalance);
      if (priceIdx <= 0) continue;
      const hwm = hwmByAccountId[acct.id];
      if (hwm == null || priceIdx + hwm * 1e-12 < hwm * (1 - nearAthFraction)) continue;

      athHarvest = true;
      const maxGross = acct.balance * maxFraction;
      const basis = Math.max(0, acct.costBasisUsd ?? 0);
      const balanceBefore = acct.balance;

      const gross = grossForTargetNet({
        targetNet: gapNet,
        balance: balanceBefore,
        costBasisUsd: basis,
        type: acct.type,
        filing,
        taxableIncome: taxableIncomeProxy + totalGain,
        maxGross,
      });
      if (gross < 1) continue;

      const { gain, tax, net, basisSold } = estimateSaleTax({
        proceeds: gross,
        balanceBefore,
        costBasisUsd: basis,
        type: acct.type,
        filing,
        taxableIncome: taxableIncomeProxy + totalGain,
      });

      const { unitsSold, price } = sellAltProceeds(acct, gross);
      acct.costBasisUsd = Math.max(0, basis - basisSold);

      gapNet -= net;
      totalGross += gross;
      totalTax += tax;
      totalGain += gain;

      const drawdownPct = Math.max(0, (1 - priceIdx / hwm) * 100);
      const reason = `${priceIdx > hwm ? 'New ATH' : drawdownPct < 0.001 ? 'At ATH' : `${drawdownPct.toFixed(1)}% below ATH`} (within ${(nearAthFraction * 100).toFixed(1)}%); liquid buffer ${runway.bufferYears.toFixed(1)}y < ${targetYears}y target`;
      sales.push({
        accountId: acct.id,
        accountType: acct.type,
        gross,
        gain,
        tax,
        net,
        unitsSold,
        price,
        reason,
      });

      if (acct.type === 'bitcoin') {
        bitcoinUsd += gross;
        if (price != null) {
          bitcoinPrice = price;
          if (unitsSold > 0) {
            bitcoinBtc += unitsSold;
            trackedBtc = true;
          }
        }
      } else if (acct.type === 'crypto') cryptoUsd += gross;
      else if (acct.type === 'gold') goldUsd += gross;
      else if (acct.type === 'silver') silverUsd += gross;
    }
  }

  const totalNet = totalGross - totalTax;
  if (totalNet < 1) return empty;

  let hysa = accounts.find((a) => a.type === 'hysa' && a.owner === 'primary');
  if (!hysa) hysa = accounts.find((a) => a.type === 'hysa');
  if (!hysa) {
    hysa = {
      id: '__harvest_hysa',
      type: 'hysa',
      owner: 'primary',
      balance: 0,
      annualContribution: 0,
      expectedReturn: plan.assumptions.cashReturn,
    };
    accounts.push(hysa);
  }
  hysa.balance += totalNet;

  return {
    totalNet,
    totalGross,
    totalTax,
    totalGain,
    athHarvest,
    bitcoinUsd,
    bitcoinBtc: trackedBtc ? bitcoinBtc : null,
    bitcoinPrice,
    cryptoUsd,
    goldUsd,
    silverUsd,
    sales,
  };
}
