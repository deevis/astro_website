import { ACCOUNT_TYPE_LABELS, type RetirementPlan } from './types';
import { BITCOIN_PRICING_MODEL_LABELS } from './bitcoinPricingModels';

/** Reject malformed backups before they replace a usable plan or enter a simulation. */
export function validatePlan(plan: RetirementPlan): void {
  const fail = (field: string) => { throw new Error('Invalid plan: check ' + field + '.'); };
  const finite = (value: unknown, min: number, max: number, field: string) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(field);
  };
  if (!plan || typeof plan !== 'object' || typeof plan.name !== 'string') fail('plan name');
  for (const person of [plan.primary, ...(plan.spouse ? [plan.spouse] : [])]) {
    if (!person) fail('household');
    finite(person.currentAge, 18, 120, 'current age');
    finite(person.retirementAge, 18, 120, 'retirement age');
    finite(person.lifeExpectancy, person.currentAge, 120, 'life expectancy');
    finite(person.medicareStartAge, 18, 120, 'Medicare age');
    if (person.birthMonth != null) finite(person.birthMonth, 1, 12, 'birth month');
  }
  if (!['single', 'married'].includes(plan.filingStatus)) fail('filing status');
  for (const key of ['accounts', 'income', 'expenses', 'socialSecurity', 'realEstate', 'otherAssets'] as const) {
    if (!Array.isArray(plan[key])) fail(key);
    if (plan[key]!.some((item: unknown) => !item || typeof item !== 'object')) fail(key);
  }
  const ids = new Set<string>();
  for (const account of plan.accounts) {
    if (!account.id || ids.has(account.id)) fail('unique account IDs');
    ids.add(account.id);
    if (!(account.type in ACCOUNT_TYPE_LABELS)) fail('account type');
    if (!['primary', 'spouse', 'joint'].includes(account.owner)) fail('account owner');
    finite(account.balance, 0, 1e15, 'account balance');
    finite(account.annualContribution, 0, 1e12, 'annual contribution');
    finite(account.expectedReturn, -1, 10, 'account return');
    for (const key of ['assetUnits', 'spotPriceUsd', 'costBasisUsd', 'employerMatchAnnual'] as const) {
      if (account[key] != null) finite(account[key], 0, 1e15, key);
    }
  }
  for (const item of [...plan.income, ...plan.expenses]) {
    finite(item.annualAmount, 0, 1e12, 'annual income or expenses');
    finite(item.startAge, 0, 120, 'income or expense start age');
    if (item.endAge != null) finite(item.endAge, item.startAge, 120, 'income or expense end age');
  }
  for (const person of plan.socialSecurity) {
    if (!Array.isArray(person.earningsHistory)) fail('earnings history');
    finite(person.claimAge, 62, 70, 'Social Security claim age');
    for (const year of person.earningsHistory) {
      if (!year) fail('earnings year');
      finite(year.year, 1900, 2200, 'earnings year');
      finite(year.amount, 0, 1e12, 'earnings amount');
    }
  }
  if (!plan.assumptions || !plan.taxStrategy) fail('assumptions');
  finite(plan.assumptions.inflationRate, -0.99, 1, 'inflation');
  finite(plan.assumptions.bitcoinReturn, -1, 10, 'Bitcoin return');
  finite(plan.assumptions.monteCarloRuns, 100, 10000, 'Monte Carlo runs');
  finite(plan.assumptions.successThreshold, 0, 1, 'success threshold');
  if (!(plan.assumptions.bitcoinPricingModel! in BITCOIN_PRICING_MODEL_LABELS)) fail('Bitcoin price model');
  if (!Array.isArray(plan.taxStrategy.customConversionByYear)) fail('conversion schedule');
  for (const row of plan.taxStrategy.customConversionByYear) {
    if (!row) fail('conversion schedule');
    finite(row.year, 1900, 2200, 'conversion year');
    finite(row.amount, 0, 1e12, 'conversion amount');
  }
  // Catch numeric strings, nulls and non-finite values in known numeric fields.
  const numericKeys = /(?:Amount|Annual|Balance|Value|Cost|Rate|Return|Volatility|Fraction|Years|Age|Percent|Ceiling|Threshold|Usd)$/;
  function walk(value: unknown, path: string) {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (item != null && numericKeys.test(key) && !['favorCashInDownYears', 'convertInSsGapYears'].includes(key) && typeof item !== 'object') finite(item, -1e15, 1e15, path + key);
      if (typeof item === 'number' && !Number.isFinite(item)) fail(path + key);
      if (item && typeof item === 'object') walk(item, path + key + '.');
    }
  }
  walk(plan, '');
}
