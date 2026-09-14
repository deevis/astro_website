import type { AccountType } from '../types';
import { bracketCeiling, irmaaFirstCliff, FEDERAL_BRACKET_TOPS_SINGLE, FEDERAL_BRACKET_TOPS_MFJ, STANDARD_DEDUCTION_SINGLE, STANDARD_DEDUCTION_MFJ, LTCG_TOPS_SINGLE, LTCG_TOPS_MFJ, IRMAA_TIERS_SINGLE, IRMAA_TIERS_MFJ } from '../taxBrackets';
export { IRMAA_TIERS_SINGLE, IRMAA_TIERS_MFJ } from '../taxBrackets';
import {
  capitalGainsRateForAccount,
  estimateSaleTax,
  grossForTargetNet,
  ltcgFederalRate,
  longTermCapitalGainsTax,
} from '../capitalGainsTax';

export type FilingStatus = 'single' | 'married';


export interface AnnualTaxInputs {
  filing: FilingStatus;
  inflationFactor: number;
  wagesAndOtherIncome: number;
  traditionalWithdrawals: number;
  rothConversion: number;
  rmd: number;
  socialSecurityGross: number;
  ltcgGains: number;
  collectiblesGains: number;
}

export interface AnnualTaxResult {
  magi: number;
  taxableIncome: number;
  ssTaxableAmount: number;
  ssTaxableFraction: number;
  ordinaryTax: number;
  ltcgTax: number;
  collectiblesTax: number;
  totalTax: number;
  effectiveRate: number;
  marginalOrdinaryRate: number;
  irmaaTier: number;
}

/** Provisional income → taxable SS fraction (simplified federal formula). */
export function socialSecurityTaxableFraction(
  filing: FilingStatus,
  provisionalIncome: number,
  ssGross: number
): number {
  if (ssGross <= 0) return 0;
  const base = filing === 'married' ? 32_000 : 25_000;
  const upper = filing === 'married' ? 44_000 : 34_000;
  if (provisionalIncome <= base) return 0;
  const lowerTaxable = Math.min(ssGross * 0.5, Math.max(0, provisionalIncome - base) * 0.5);
  if (provisionalIncome <= upper) return lowerTaxable / ssGross;
  return Math.min(ssGross * 0.85, (provisionalIncome - upper) * 0.85 + Math.min(ssGross * 0.5, (upper - base) * 0.5)) / ssGross;
}

export function provisionalIncome(
  wages: number,
  taxExemptInterest: number,
  ssGross: number,
  otherIncome: number
): number {
  return wages + taxExemptInterest + otherIncome + ssGross * 0.5;
}

function progressiveOrdinaryTax(taxableIncome: number, filing: FilingStatus): number {
  const tops =
    filing === 'married'
      ? FEDERAL_BRACKET_TOPS_MFJ.map((b) => b.taxableIncomeTop)
      : FEDERAL_BRACKET_TOPS_SINGLE.map((b) => b.taxableIncomeTop);
  const rates = [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];
  let tax = 0;
  let prev = 0;
  for (let i = 0; i < tops.length; i++) {
    const top = tops[i];
    if (taxableIncome <= prev) break;
    const slice = Math.min(taxableIncome, top) - prev;
    if (slice > 0) tax += slice * rates[i];
    prev = top;
  }
  return tax;
}

export function computeAnnualTax(inputs: AnnualTaxInputs): AnnualTaxResult {
  const deduction =
    (inputs.filing === 'married' ? STANDARD_DEDUCTION_MFJ : STANDARD_DEDUCTION_SINGLE) *
    inputs.inflationFactor;

  const ordinaryGross =
    inputs.wagesAndOtherIncome +
    inputs.traditionalWithdrawals +
    inputs.rothConversion +
    inputs.rmd;

  const prov = provisionalIncome(
    inputs.wagesAndOtherIncome + inputs.traditionalWithdrawals + inputs.rmd + inputs.rothConversion,
    0,
    inputs.socialSecurityGross,
    inputs.ltcgGains + inputs.collectiblesGains
  );
  const ssFrac = socialSecurityTaxableFraction(
    inputs.filing,
    prov,
    inputs.socialSecurityGross
  );
  const ssTaxable = inputs.socialSecurityGross * ssFrac;

  const taxableIncome = Math.max(
    0,
    ordinaryGross + ssTaxable + inputs.ltcgGains + inputs.collectiblesGains - deduction
  );

  const ordinaryTaxable = Math.max(0, ordinaryGross + ssTaxable - deduction);
  const ordinaryTax = progressiveOrdinaryTax(ordinaryTaxable / inputs.inflationFactor, inputs.filing) * inputs.inflationFactor;

  const unusedDeduction = Math.max(0, deduction - ordinaryGross - ssTaxable);
  const collectiblesTaxable = Math.max(0, inputs.collectiblesGains - unusedDeduction);
  const remainingDeduction = Math.max(0, unusedDeduction - inputs.collectiblesGains);
  const ltcgTax = longTermCapitalGainsTax(inputs.filing, ordinaryTaxable + collectiblesTaxable, Math.max(0, inputs.ltcgGains - remainingDeduction), inputs.inflationFactor);
  const collectiblesTax = Math.min(collectiblesTaxable * 0.28, progressiveOrdinaryTax((ordinaryTaxable + collectiblesTaxable) / inputs.inflationFactor, inputs.filing) * inputs.inflationFactor - ordinaryTax);

  const totalTax = ordinaryTax + ltcgTax + collectiblesTax;
  const magi =
    inputs.wagesAndOtherIncome +
    inputs.traditionalWithdrawals +
    inputs.rothConversion +
    inputs.rmd +
    ssTaxable +
    inputs.ltcgGains +
    inputs.collectiblesGains;

  const tiers = inputs.filing === 'married' ? IRMAA_TIERS_MFJ : IRMAA_TIERS_SINGLE;
  const inflatedTiers = tiers.map((t) => t * inputs.inflationFactor);
  let irmaaTier = 0;
  for (let i = inflatedTiers.length - 1; i >= 0; i--) {
    if (magi > inflatedTiers[i]) {
      irmaaTier = i + 1;
      break;
    }
  }

  const marginalOrdinaryRate = marginalOrdinaryRateFor(inputs.filing, ordinaryTaxable / inputs.inflationFactor);

  return {
    magi,
    taxableIncome,
    ssTaxableAmount: ssTaxable,
    ssTaxableFraction: ssFrac,
    ordinaryTax,
    ltcgTax,
    collectiblesTax,
    totalTax,
    effectiveRate: magi > 0 ? totalTax / magi : 0,
    marginalOrdinaryRate,
    irmaaTier,
  };
}

function marginalOrdinaryRateFor(filing: FilingStatus, taxableIncome: number): number {
  const tops =
    filing === 'married'
      ? FEDERAL_BRACKET_TOPS_MFJ.map((b) => b.taxableIncomeTop)
      : FEDERAL_BRACKET_TOPS_SINGLE.map((b) => b.taxableIncomeTop);
  const rates = [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];
  for (let i = 0; i < tops.length; i++) {
    if (taxableIncome <= tops[i]) return rates[i];
  }
  return 0.37;
}

export interface TaxHeadroom {
  bracketHeadroom: number;
  irmaaHeadroom: number;
  ltcgZeroRoom: number;
}

export function taxHeadroom(
  filing: FilingStatus,
  currentMagi: number,
  targetBracketRate: number,
  irmaaAware: boolean,
  inflationFactor: number
): TaxHeadroom {
  const bracketTop = bracketCeiling(filing, targetBracketRate) * inflationFactor;
  const bracketHeadroom = Math.max(0, bracketTop - currentMagi);
  const cliff = irmaaFirstCliff(filing) * inflationFactor;
  const irmaaHeadroom = irmaaAware ? Math.max(0, cliff - 1_000 - currentMagi) : Infinity;
  const ltcgZeroTop = (filing === 'married' ? LTCG_TOPS_MFJ[0] : LTCG_TOPS_SINGLE[0]) * inflationFactor;
  const ltcgZeroRoom = Math.max(0, ltcgZeroTop - currentMagi);

  return { bracketHeadroom, irmaaHeadroom, ltcgZeroRoom };
}

export interface TransactionTaxCost {
  incrementalTax: number;
  reason: string;
}

/** Estimate incremental tax from adding ordinary income (e.g. Roth conversion). */
export function taxCostOfOrdinaryIncome(
  base: AnnualTaxInputs,
  additionalOrdinary: number
): TransactionTaxCost {
  const before = computeAnnualTax(base);
  const after = computeAnnualTax({
    ...base,
    rothConversion: base.rothConversion + additionalOrdinary,
  });
  return {
    incrementalTax: after.totalTax - before.totalTax,
    reason: `Ordinary income +${additionalOrdinary.toFixed(0)} → tax +${(after.totalTax - before.totalTax).toFixed(0)}`,
  };
}

export { estimateSaleTax, grossForTargetNet, capitalGainsRateForAccount };

export type { AccountType };
