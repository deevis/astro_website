import type { RetirementPlan } from '../types';
import { requiredMinimumDistribution } from '../rmd';
import type { MutableAccount } from '../accountOps';
import { withdrawRmdFromTraditional, contributeToAccount } from '../accountOps';
import { POLICY_IDS } from './withdrawal';

export interface RmdYearResult {
  rmd: number;
  appliedToSpending: number;
  surplus: number;
  primaryRmd: number;
  spouseRmd: number;
  reason: string;
}

export function executeRmdPolicy(
  plan: RetirementPlan,
  accounts: MutableAccount[],
  age: number,
  primaryRmdAge: number,
  spouseRmdAge: number | null,
  spouseAgeNow: number | null,
  spendingNeed: number,
  priorYearBalances?: Record<string, number>
): RmdYearResult {
  let rmd = 0;
  let primaryRmd = 0;
  let spouseRmd = 0;
  const primaryHitsRmd = age >= primaryRmdAge;
  const spouseHitsRmd =
    spouseRmdAge != null && spouseAgeNow != null && spouseAgeNow >= spouseRmdAge;

  if (primaryHitsRmd) {
    const tradBal = accounts
      .filter(
        (a) =>
          (a.type === 'traditionalIra' || a.type === 'traditional401k') &&
          (a.owner === 'primary' || a.owner === 'joint')
      )
      .reduce((s, a) => s + (priorYearBalances?.[a.id] ?? a.balance), 0);
    const due = requiredMinimumDistribution(tradBal, age);
    if (due > 0) {
      primaryRmd = withdrawRmdFromTraditional(accounts, 'primary', due);
      rmd += primaryRmd;
    }
  }
  if (spouseHitsRmd && spouseAgeNow != null) {
    const tradBal = accounts
      .filter(
        (a) =>
          (a.type === 'traditionalIra' || a.type === 'traditional401k') && a.owner === 'spouse'
      )
      .reduce((s, a) => s + (priorYearBalances?.[a.id] ?? a.balance), 0);
    const due = requiredMinimumDistribution(tradBal, spouseAgeNow);
    if (due > 0) {
      spouseRmd = withdrawRmdFromTraditional(accounts, 'spouse', due);
      rmd += spouseRmd;
    }
  }

  const policy = plan.taxStrategy.rmdPolicy ?? 'minimumOnly';
  const appliedToSpending = Math.min(rmd, spendingNeed);
  let surplus = rmd - appliedToSpending;

  if (surplus > 0) {
    if (policy === 'spendFromRmdFirst') {
      // Surplus already handled — RMD counts toward spending first (applied above)
    }
    let sink =
      accounts.find((a) => a.type === 'brokerage') ??
      accounts.find((a) => a.type === 'hysa') ??
      accounts.find((a) => a.type === 'cd') ??
      accounts.find((a) => a.type === 'bond');
    if (!sink) {
      sink = { id: '__rmd_cash', type: 'hysa', owner: 'primary', balance: 0, annualContribution: 0, expectedReturn: plan.assumptions.cashReturn };
      accounts.push(sink);
    }
    contributeToAccount(sink, surplus);
  }

  return {
    rmd,
    appliedToSpending,
    surplus,
    primaryRmd,
    spouseRmd,
    reason: `${POLICY_IDS.rmd}: ${policy} — RMD ${rmd.toFixed(0)} (${appliedToSpending.toFixed(0)} to spending)`,
  };
}

/** Whether Roth conversion should run before RMD this year. */
export function rothBeforeRmd(plan: RetirementPlan): boolean {
  // Current-year RMDs must be satisfied before any Roth conversion.
  return false;
}
