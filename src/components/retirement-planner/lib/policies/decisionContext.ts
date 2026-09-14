import type { RetirementPlan } from '../types';
import type { MutableAccount } from '../accountOps';
import { computeRunway } from '../runway';
import { taxHeadroom, type FilingStatus } from '../tax/federalTaxEngine';
import { primaryClaimAge } from './rothConversion';

/** Read-only snapshot policies use to propose decisions without mutating accounts. */
export interface DecisionContext {
  plan: RetirementPlan;
  accounts: readonly MutableAccount[];
  age: number;
  yearIndex: number;
  calendarYear: number;
  inflation: number;
  inflationFactor: number;
  filing: FilingStatus;
  isRetired: boolean;
  downYear: boolean;
  portfolioReturn: number;
  income: number;
  socialSecurity: number;
  expenses: number;
  spendingNeed: number;
  rmd: number;
  taxableIncomeProxy: number;
  bufferYears: number;
  taxHeadroom: ReturnType<typeof taxHeadroom>;
  inSsGap: boolean;
  primaryClaimAge: number;
}

export function buildDecisionContext(input: {
  plan: RetirementPlan;
  accounts: readonly MutableAccount[];
  age: number;
  yearIndex: number;
  calendarYear: number;
  inflation: number;
  downYear: boolean;
  portfolioReturn: number;
  income: number;
  socialSecurity: number;
  expenses: number;
  spendingNeed: number;
  rmd: number;
  totalSpendAnnual: number;
}): DecisionContext {
  const inflationFactor = Math.pow(1 + input.inflation, input.yearIndex);
  const filing: FilingStatus = input.plan.filingStatus === 'married' ? 'married' : 'single';
  const ssTaxable = input.socialSecurity * 0.85;
  const currentMagi = input.income + ssTaxable + input.rmd;
  const runway = computeRunway(input.plan, input.accounts, input.totalSpendAnnual);
  const claimAge = primaryClaimAge(input.plan);

  return {
    plan: input.plan,
    accounts: input.accounts,
    age: input.age,
    yearIndex: input.yearIndex,
    calendarYear: input.calendarYear,
    inflation: input.inflation,
    inflationFactor,
    filing,
    isRetired: input.age >= input.plan.primary.retirementAge,
    downYear: input.downYear,
    portfolioReturn: input.portfolioReturn,
    income: input.income,
    socialSecurity: input.socialSecurity,
    expenses: input.expenses,
    spendingNeed: input.spendingNeed,
    rmd: input.rmd,
    taxableIncomeProxy: input.income + input.rmd,
    bufferYears: runway.bufferYears,
    taxHeadroom: taxHeadroom(
      filing,
      currentMagi,
      input.plan.taxStrategy.targetFederalBracketCeiling,
      input.plan.taxStrategy.irmaaAvoidance,
      inflationFactor
    ),
    inSsGap:
      input.age >= input.plan.primary.retirementAge &&
      input.age < claimAge &&
      input.plan.taxStrategy.convertInSsGapYears,
    primaryClaimAge: claimAge,
  };
}
