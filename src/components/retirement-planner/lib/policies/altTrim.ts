import type { AccountType, RetirementPlan } from '../types';
import { allocationTrimEnabled, healthPremiumsAtAge } from '../types';
import { estimateSaleTax, grossForTargetNet } from '../tax/federalTaxEngine';
import type { MutableAccount } from '../accountOps';
import { sellAltProceeds } from '../accountOps';
import { primaryClaimAge } from './rothConversion';
import type { AthHarvestResult, AthHarvestSaleDetail } from './athHarvest';

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

function inTrimWindow(plan: RetirementPlan, age: number): boolean {
  const window = plan.bitcoinStrategy?.trimWindow ?? 'anytime';
  if (window === 'anytime') return true;
  if (age < plan.primary.retirementAge) return false;
  if (window === 'retirement') return true;
  return age < primaryClaimAge(plan);
}

function emptyTrim(): AthHarvestResult {
  return {
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
}

function depositToHysa(plan: RetirementPlan, accounts: MutableAccount[], net: number): void {
  if (net < 1) return;
  let hysa = accounts.find((a) => a.type === 'hysa' && a.owner === 'primary');
  if (!hysa) hysa = accounts.find((a) => a.type === 'hysa');
  if (!hysa) {
    hysa = {
      id: '__trim_hysa',
      type: 'hysa',
      owner: 'primary',
      balance: 0,
      annualContribution: 0,
      expectedReturn: plan.assumptions.cashReturn,
    };
    accounts.push(hysa);
  }
  hysa.balance += net;
}

/**
 * Proactive BTC/crypto clips that do not wait for ATH.
 * Triggers when the alt sleeve is overweight vs remaining non-alt assets,
 * or when HYSA runway is below the configured floor. Each year sells only a
 * small sleeve fraction so the path de-risks early instead of HODLing a grind-down.
 */
export function trimAltsToCash(
  plan: RetirementPlan,
  accounts: MutableAccount[],
  age: number,
  yearIndex: number,
  inflation: number,
  taxableIncomeProxy: number,
  annualSpending?: number
): AthHarvestResult {
  if (!allocationTrimEnabled(plan)) return emptyTrim();
  if (!inTrimWindow(plan, age)) return emptyTrim();

  const strategy = plan.bitcoinStrategy!;
  const maxShare = Math.min(2, Math.max(0, strategy.maxAltShareOfNonAlt ?? 0.35));
  const maxFraction = Math.min(1, Math.max(0, strategy.trimMaxSleeveFraction ?? 0.08));
  const cashYears = Math.max(0, strategy.trimWhenCashBelowYears ?? 2);
  const includeCrypto = strategy.includeCryptoInTrim !== false;
  if (maxFraction <= 0) return emptyTrim();

  const spendAnnual =
    annualSpending ??
    inflate(retirementSpendToday(plan) + healthPremiumsAtAge(plan, age).dueTotal, inflation, yearIndex);

  const bitcoinUsd = accounts.filter((a) => a.type === 'bitcoin').reduce((s, a) => s + Math.max(0, a.balance), 0);
  const cryptoUsd = includeCrypto
    ? accounts.filter((a) => a.type === 'crypto').reduce((s, a) => s + Math.max(0, a.balance), 0)
    : 0;
  const altUsd = bitcoinUsd + cryptoUsd;
  const nonAltUsd = accounts.reduce((s, a) => {
    if (a.type === 'bitcoin') return s;
    if (includeCrypto && a.type === 'crypto') return s;
    return s + Math.max(0, a.balance);
  }, 0);
  const hysaUsd = accounts.filter((a) => a.type === 'hysa').reduce((s, a) => s + Math.max(0, a.balance), 0);

  const targetAltUsd = nonAltUsd > 1 ? maxShare * nonAltUsd : 0;
  const overweightGap = Math.max(0, altUsd - targetAltUsd);
  const cashGap = spendAnnual > 0 ? Math.max(0, spendAnnual * cashYears - hysaUsd) : 0;
  const cashShort = cashYears > 0 && cashGap >= 1;
  const overweight = overweightGap >= 1;
  if (!overweight && !cashShort) return emptyTrim();

  let gapNet = Math.max(overweightGap, cashGap);
  if (gapNet < 1) return emptyTrim();

  const filing = plan.filingStatus === 'married' ? 'married' : 'single';
  const types: AccountType[] = includeCrypto ? ['bitcoin', 'crypto'] : ['bitcoin'];
  const sales: AthHarvestSaleDetail[] = [];
  let bitcoinSold = 0;
  let bitcoinBtc = 0;
  let trackedBtc = false;
  let bitcoinPrice: number | null = null;
  let cryptoSold = 0;
  let totalGross = 0;
  let totalTax = 0;
  let totalGain = 0;

  for (const type of types) {
    if (gapNet < 1) break;
    for (const acct of accounts.filter((a) => a.type === type && a.balance > 0)) {
      if (gapNet < 1) break;
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

      const sharePct = nonAltUsd > 1 ? (altUsd / nonAltUsd) * 100 : 999;
      const hysaYears = spendAnnual > 0 ? hysaUsd / spendAnnual : 999;
      const reasons: string[] = [];
      if (overweight) {
        reasons.push(
          `alt sleeve ${sharePct.toFixed(0)}% of non-alt vs ${(maxShare * 100).toFixed(0)}% cap`
        );
      }
      if (cashShort) {
        reasons.push(`HYSA ${hysaYears.toFixed(1)}y < ${cashYears}y floor`);
      }
      sales.push({
        accountId: acct.id,
        accountType: acct.type,
        gross,
        gain,
        tax,
        net,
        unitsSold,
        price,
        reason: `Balanced trim: ${reasons.join('; ')}`,
      });

      if (acct.type === 'bitcoin') {
        bitcoinSold += gross;
        if (price != null) {
          bitcoinPrice = price;
          if (unitsSold > 0) {
            bitcoinBtc += unitsSold;
            trackedBtc = true;
          }
        }
      } else cryptoSold += gross;
    }
  }

  const totalNet = totalGross - totalTax;
  if (totalNet < 1) return emptyTrim();
  depositToHysa(plan, accounts, totalNet);

  return {
    totalNet,
    totalGross,
    totalTax,
    totalGain,
    athHarvest: false,
    bitcoinUsd: bitcoinSold,
    bitcoinBtc: trackedBtc ? bitcoinBtc : null,
    bitcoinPrice,
    cryptoUsd: cryptoSold,
    goldUsd: 0,
    silverUsd: 0,
    sales,
  };
}
