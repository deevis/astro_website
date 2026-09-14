import type { RetirementPlan } from '../types';
import { conversionRoom } from '../taxBrackets';
import { taxCostOfOrdinaryIncome, type AnnualTaxInputs } from '../tax/federalTaxEngine';
import type { MutableAccount } from '../accountOps';
import { withdrawWithDetail } from '../accountOps';
import { POLICY_IDS } from './withdrawal';

export function primaryClaimAge(plan: RetirementPlan): number {
  return plan.socialSecurity.find((s) => s.owner === 'primary')?.claimAge ?? 70;
}

export function inSsGapYear(plan: RetirementPlan, age: number): boolean {
  if (!plan.taxStrategy.convertInSsGapYears) return false;
  if (age < plan.primary.retirementAge) return false;
  return age < primaryClaimAge(plan);
}

export interface RothConversionResult {
  converted: number;
  estimatedTax: number;
  taxFundingGains?: number;
  reason: string;
}

/**
 * Convert Traditional → Roth up to bracket / IRMAA room (or custom schedule).
 * Tax funded from taxable cash; uses federal tax engine for incremental cost.
 */
export function performRothConversion(
  plan: RetirementPlan,
  accounts: MutableAccount[],
  age: number,
  yearIndex: number,
  inflation: number,
  income: number,
  socialSecurity: number,
  rmd: number,
  realizedGains = 0
): RothConversionResult {
  const empty: RothConversionResult = { converted: 0, estimatedTax: 0, reason: '' };
  const policy = plan.taxStrategy.rothConversionPolicy;
  if (policy === 'none') return empty;
  if (!inSsGapYear(plan, age)) return empty;

  const inflationFactor = Math.pow(1 + inflation, yearIndex);
  const filing = plan.filingStatus === 'married' ? 'married' : 'single';
  const ssTaxable = socialSecurity * 0.85;
  const currentMagi = income + ssTaxable + rmd + realizedGains;

  const irmaaAware =
    policy === 'irmaaAware' ||
    (policy === 'fillBracket' && plan.taxStrategy.irmaaAvoidance) ||
    policy === 'customSchedule';

  const preMedicare = age < plan.primary.medicareStartAge;
  const useIrmaa = irmaaAware || (preMedicare && plan.taxStrategy.irmaaAvoidance);

  let room = conversionRoom({
    filing,
    currentMagi,
    targetBracketRate: plan.taxStrategy.targetFederalBracketCeiling,
    irmaaAware: useIrmaa,
    inflationFactor,
  });

  if (policy === 'customSchedule') {
    const calYear = new Date().getFullYear() + yearIndex;
    const custom = plan.taxStrategy.customConversionByYear.find((c) => c.year === calYear);
    if (!custom || custom.amount < 100) {
      return { ...empty, reason: 'Custom schedule: no conversion scheduled this year' };
    }
    room = Math.min(room, custom.amount);
  }

  if (room < 100) {
    return { ...empty, reason: 'No bracket or IRMAA headroom for Roth conversion' };
  }

  const trad = accounts.filter(
    (a) => (a.type === 'traditionalIra' || a.type === 'traditional401k') && a.balance > 0
  );
  const tradTotal = trad.reduce((s, a) => s + a.balance, 0);
  if (tradTotal < 100) return empty;

  let target = Math.min(room, tradTotal);

  const baseTax: AnnualTaxInputs = {
    filing,
    inflationFactor,
    wagesAndOtherIncome: income,
    traditionalWithdrawals: 0,
    rothConversion: 0,
    rmd,
    socialSecurityGross: socialSecurity,
    ltcgGains: realizedGains,
    collectiblesGains: 0,
  };

  const taxCost = taxCostOfOrdinaryIncome(baseTax, target);
  let taxNeeded = taxCost.incrementalTax;
  const availableTaxCash = accounts.filter((a) => ['hysa', 'cd', 'brokerage', 'bond'].includes(a.type)).reduce((sum, a) => sum + a.balance, 0);
  if (availableTaxCash < taxNeeded && taxNeeded > 0) {
    let lo = 0;
    let hi = target;
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2;
      const tc = taxCostOfOrdinaryIncome(baseTax, mid);
      if (tc.incrementalTax <= availableTaxCash) lo = mid;
      else hi = mid;
    }
    target = lo;
    if (target < 100) return empty;
    taxNeeded = taxCostOfOrdinaryIncome(baseTax, target).incrementalTax;
  }
  const taxPayment = withdrawWithDetail(accounts, ['hysa', 'cd', 'brokerage', 'bond'], taxNeeded);

  let remaining = target;
  for (const acct of trad) {
    if (remaining <= 0) break;
    const move = Math.min(acct.balance, remaining);
    acct.balance -= move;
    remaining -= move;
    const owner = acct.owner === 'spouse' ? 'spouse' : 'primary';
    let roth = accounts.find((a) => a.type === 'rothIra' && a.owner === owner);
    if (!roth) {
      roth = { id: `__roth_conversion_${owner}`, type: 'rothIra', owner, balance: 0, annualContribution: 0, expectedReturn: plan.assumptions.equityReturn };
      accounts.push(roth);
    }
    roth.balance += move;
  }
  const converted = target - remaining;


  const reason =
    policy === 'customSchedule'
      ? `Custom schedule conversion up to ${converted.toFixed(0)}`
      : `Fill ${(plan.taxStrategy.targetFederalBracketCeiling * 100).toFixed(0)}% bracket${useIrmaa ? ' (IRMAA-aware)' : ''}`;

  return {
    converted,
    estimatedTax: taxPayment.total,
    taxFundingGains: taxPayment.details.reduce((sum, detail) => sum + (detail.realizedGain ?? 0), 0),
    reason: `${POLICY_IDS.rothConversion}: ${reason}`,
  };
}
