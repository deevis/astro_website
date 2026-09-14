import { validatePlan } from './planValidation';
import type { RetirementPlan, PlannerSectionId } from './types';

export interface SectionStatus {
  id: PlannerSectionId;
  complete: boolean;
  hint: string;
}

export function getSectionStatuses(plan: RetirementPlan): SectionStatus[] {
  const hasAccounts = plan.accounts.length > 0;
  const totalBalance = plan.accounts.reduce((s, a) => s + a.balance, 0);
  const hasExpenses =
    plan.assumptions.useSpendFromPlan && plan.expenses.length > 0
      ? plan.expenses.some((e) => e.annualAmount > 0)
      : plan.assumptions.withdrawalRate > 0;
  const ssReady = plan.socialSecurity.some(
    (s) => s.estimatedMonthlyBenefit != null && s.estimatedMonthlyBenefit > 0
  );
  const ssEntered = plan.socialSecurity.some((s) => s.earningsHistory.length > 0);

  return [
    {
      id: 'household',
      complete: plan.primary.currentAge > 0 && plan.primary.lifeExpectancy > plan.primary.currentAge,
      hint: 'Set ages and life expectancy',
    },
    {
      id: 'assets',
      complete: hasAccounts && totalBalance > 0,
      hint: 'Add at least one account with a balance',
    },
    {
      id: 'bitcoin',
      complete: true,
      hint: plan.accounts.some((a) => a.type === 'bitcoin' || a.type === 'crypto')
        ? plan.bitcoinStrategy?.sellPolicy === 'allocationTrim'
          ? 'Balanced trim playbook'
          : plan.bitcoinStrategy?.sellPolicy === 'athAndTrim'
            ? 'ATH + trim playbook'
            : 'Near-ATH harvest playbook'
        : 'Optional — price path and sell playbook',
    },
    {
      id: 'realEstate',
      complete: true,
      hint:
        (plan.realEstate?.length ?? 0) > 0
          ? `${plan.realEstate!.length} propert${plan.realEstate!.length === 1 ? 'y' : 'ies'}`
          : 'Optional — primary home and rentals',
    },
    {
      id: 'otherAssets',
      complete: true,
      hint:
        (plan.otherAssets?.length ?? 0) > 0
          ? `${plan.otherAssets!.length} item${plan.otherAssets!.length === 1 ? '' : 's'}`
          : 'Optional — vehicles, art, collectibles',
    },
    {
      id: 'incomeExpenses',
      complete: hasExpenses || plan.income.length > 0,
      hint: 'Add expenses or income streams',
    },
    {
      id: 'socialSecurity',
      complete: ssReady,
      hint: ssEntered ? 'Run Calculate benefits' : 'Paste earnings and calculate',
    },
    {
      id: 'assumptions',
      complete: true,
      hint: 'Defaults are fine — adjust if needed',
    },
    {
      id: 'dateOptimizer',
      complete: hasAccounts && hasExpenses,
      hint: 'Needs assets and spending — then sweep ages 55–70',
    },
    {
      id: 'ramp',
      complete: hasAccounts && hasExpenses,
      hint: 'Run the RAMP pre-flight checklist after assets and spending',
    },
    {
      id: 'projection',
      complete: hasAccounts && hasExpenses,
      hint: 'Needs assets and spending inputs',
    },
    {
      id: 'monteCarlo',
      complete: hasAccounts && hasExpenses,
      hint: 'Needs assets and spending inputs',
    },
    {
      id: 'taxStrategy',
      complete: plan.taxStrategy.rothConversionPolicy !== 'none' || plan.taxStrategy.downYearExpenseCut > 0,
      hint: 'Down-year cuts, Roth gap conversions, IRMAA',
    },
  ];
}

export function readyForProjection(plan: RetirementPlan): boolean {
  try { validatePlan(plan); } catch { return false; }
  const statuses = getSectionStatuses(plan);
  return statuses
    .filter((s) => ['household', 'assets', 'incomeExpenses'].includes(s.id))
    .every((s) => s.complete);
}
