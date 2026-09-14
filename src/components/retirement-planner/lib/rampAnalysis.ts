import type { Account, AccountType, RetirementPlan } from './types';
import {
  incomeEndsAtRetirement,
  realEstateCarryingCostAtAge,
  realEstateNetEquity,
  allocationTrimEnabled,
  athHarvestPolicyEnabled,
} from './types';
import { computeRunway } from './runway';
import { projectCashflow, type ProjectionResult, type ProjectionYear } from './cashflow';
import { createRng, makeReturnSampler } from './monteCarloCore';

/** Light Monte Carlo for RAMP average-path analysis */
export const RAMP_MC_RUNS = 200;

export const IRA_PENALTY_FREE_AGE = 59.5;
const ACCESSIBLE_BUFFER = 1.05;
const MIN_BUFFER_YEARS = 2;
const STRESS_EQUITY_RETURN = -0.2;
const STRESS_YEARS_AFTER_RETIRE = 2;
const SEQUENCE_RISK_YEARS = 5;

export type RampPillarId = 'runway' | 'accessible' | 'medical' | 'portfolio';

export type RampPillarStatus = 'pass' | 'fail' | 'na' | 'warn';

export interface RampPillarResult {
  id: RampPillarId;
  label: string;
  status: RampPillarStatus;
  headline: string;
  metrics: { label: string; value: string }[];
  detail: string;
  remediation: string[];
}

export interface RampTimelineMarker {
  age: number;
  label: string;
  kind: 'now' | 'retire' | 'penaltyFree' | 'medicare' | 'income' | 'ss';
}

export interface RampAccessibleBreakdown {
  accessible: number;
  locked: number;
  need: number;
  shortfall: number;
  coveragePct: number;
  buckets: { label: string; amount: number }[];
}

export interface RampResult {
  overall: 'pass' | 'fail';
  passedCount: number;
  totalChecks: number;
  failedPillars: RampPillarId[];
  runway: RampPillarResult;
  accessible: RampPillarResult;
  medical: RampPillarResult;
  portfolio: RampPillarResult;
  timeline: RampTimelineMarker[];
  accessibleBreakdown: RampAccessibleBreakdown;
  retirementAge: number;
  firstGuaranteedIncomeAge: number;
  firstGuaranteedIncomeLabel: string;
  runwayYears: number;
  annualSpendAtRetirement: number;
  /** Present when evaluated on a Monte Carlo median path */
  pathMode?: 'deterministic' | 'average';
  mcRuns?: number;
  mcSuccessRate?: number;
  medianEndingBalance?: number;
  /** BTC/crypto harvested into HYSA on the evaluated path */
  cryptoHarvestOnPath?: number;
  /** Harvest years during runway on the evaluated path */
  harvestYearsOnRunway?: {
    age: number;
    amount: number;
    grossUsd: number;
    taxUsd: number;
    bitcoinUsd: number;
    bitcoinBtc: number | null;
    bitcoinPriceUsd: number | null;
    cryptoUsd: number;
    goldUsd: number;
    silverUsd: number;
  }[];
}

const ACCESSIBLE_TYPES: AccountType[] = [
  'hysa',
  'cd',
  'bond',
  'brokerage',
  'crypto',
  'bitcoin',
  'gold',
  'silver',
];

export function plannedRetirementSpend(plan: RetirementPlan): number {
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
  const retAge = plan.primary.retirementAge;
  for (const prop of plan.realEstate ?? []) {
    total += realEstateCarryingCostAtAge(prop, retAge);
  }
  for (const a of plan.otherAssets ?? []) {
    total += Math.max(0, a.annualCost);
  }
  return total;
}

function rothAccessibleBasis(account: Account, plan: RetirementPlan): number {
  if (account.contributionBasis != null && account.contributionBasis > 0) {
    return Math.min(account.balance, account.contributionBasis);
  }
  const yearsToRetire = Math.max(1, plan.primary.retirementAge - plan.primary.currentAge);
  const est = account.annualContribution * yearsToRetire;
  return Math.min(account.balance, Math.max(0, est));
}

function isRothType(type: AccountType): boolean {
  return type === 'rothIra' || type === 'roth401k';
}

function isLockedType(type: AccountType): boolean {
  return type === 'traditionalIra' || type === 'traditional401k';
}

interface GuaranteedIncomeSource {
  age: number;
  label: string;
}

function guaranteedIncomeSources(plan: RetirementPlan): GuaranteedIncomeSource[] {
  const sources: GuaranteedIncomeSource[] = [];
  const retirementAge = plan.primary.retirementAge;

  for (const ss of plan.socialSecurity) {
    if ((ss.estimatedMonthlyBenefit ?? 0) > 0) {
      const who = ss.owner === 'primary' ? plan.primary.name : plan.spouse?.name ?? 'Spouse';
      sources.push({ age: ss.claimAge, label: `Social Security (${who})` });
    }
  }

  for (const stream of plan.income) {
    if (incomeEndsAtRetirement(stream, plan.income)) continue;
    if (stream.startAge >= retirementAge && stream.annualAmount > 0) {
      sources.push({ age: stream.startAge, label: stream.label || 'Income' });
    }
  }

  // Ongoing rental NOI shortens the portfolio-only runway starting at retirement
  for (const prop of plan.realEstate ?? []) {
    if (prop.kind !== 'rental') continue;
    if (prop.netIncomeAnnual <= 0) continue;
    sources.push({
      age: retirementAge,
      label: prop.label || 'Rental income',
    });
  }

  return sources.sort((a, b) => a.age - b.age);
}

function firstGuaranteedIncome(plan: RetirementPlan): GuaranteedIncomeSource {
  const sources = guaranteedIncomeSources(plan);
  if (sources.length === 0) {
    const fallback = Math.max(
      ...plan.socialSecurity.map((s) => s.claimAge),
      plan.primary.lifeExpectancy
    );
    return { age: fallback, label: 'Social Security (estimated)' };
  }
  return sources[0]!;
}

function portfolioOnlySpendInRange(
  years: ProjectionYear[],
  startAge: number,
  endAge: number
): number {
  let total = 0;
  for (const y of years) {
    if (y.age < startAge || y.age >= endAge) continue;
    if (!y.isRetired) continue;
    total += Math.max(0, y.expenses - y.income - y.socialSecurity);
  }
  return total;
}

function runwayShortfallInRange(
  years: ProjectionYear[],
  startAge: number,
  endAge: number
): { hasShortfall: boolean; maxShortfall: number; shortfallYears: number } {
  let maxShortfall = 0;
  let shortfallYears = 0;
  for (const y of years) {
    if (y.age < startAge || y.age >= endAge) continue;
    if (!y.isRetired) continue;
    if (y.shortfall > 1) {
      shortfallYears++;
      maxShortfall = Math.max(maxShortfall, y.shortfall);
    }
  }
  return { hasShortfall: shortfallYears > 0, maxShortfall, shortfallYears };
}

function yearAtAge(years: ProjectionYear[], age: number): ProjectionYear | undefined {
  return years.find((y) => y.age === age);
}

function accessibleBalancesAtRetirement(
  plan: RetirementPlan,
  year: ProjectionYear | undefined
): RampAccessibleBreakdown {
  const buckets: { label: string; amount: number }[] = [];
  let accessible = 0;
  let locked = 0;

  if (year) {
    accessible +=
      year.cash +
      year.bonds +
      year.brokerage +
      year.crypto +
      year.bitcoin +
      (year.gold ?? 0) +
      (year.silver ?? 0);
    if (year.cash > 0) buckets.push({ label: 'Cash (HYSA/CD)', amount: year.cash });
    if (year.bonds > 0) buckets.push({ label: 'Bonds', amount: year.bonds });
    if (year.brokerage > 0) buckets.push({ label: 'Brokerage', amount: year.brokerage });
    if (year.crypto > 0) buckets.push({ label: 'Crypto', amount: year.crypto });
    if (year.bitcoin > 0) buckets.push({ label: 'Bitcoin', amount: year.bitcoin });
    if ((year.gold ?? 0) > 0) buckets.push({ label: 'Gold', amount: year.gold });
    if ((year.silver ?? 0) > 0) buckets.push({ label: 'Silver', amount: year.silver });

    let rothBasis = 0;
    for (const acct of plan.accounts) {
      if (!isRothType(acct.type)) continue;
      rothBasis += rothAccessibleBasis(acct, plan);
    }
    rothBasis = Math.min(rothBasis, year.roth);
    if (rothBasis > 0) {
      buckets.push({ label: 'Roth contributions (est.)', amount: rothBasis });
      accessible += rothBasis;
    }

    locked += year.traditional;
    const rothLocked = Math.max(0, year.roth - rothBasis);
    locked += rothLocked;
    if (year.traditional > 0) buckets.push({ label: 'Traditional / 401(k)', amount: year.traditional });
    if (rothLocked > 0) buckets.push({ label: 'Roth earnings (locked pre-59½)', amount: rothLocked });
  } else {
    for (const acct of plan.accounts) {
      const bal = Math.max(0, acct.balance);
      if (ACCESSIBLE_TYPES.includes(acct.type)) {
        accessible += bal;
        buckets.push({ label: acct.label, amount: bal });
      } else if (isRothType(acct.type)) {
        const basis = rothAccessibleBasis(acct, plan);
        accessible += basis;
        const lockedPart = Math.max(0, bal - basis);
        locked += lockedPart;
        if (basis > 0) buckets.push({ label: `${acct.label} (basis)`, amount: basis });
        if (lockedPart > 0) buckets.push({ label: `${acct.label} (earnings)`, amount: lockedPart });
      } else if (isLockedType(acct.type) || acct.type === 'roth401k') {
        locked += bal;
        buckets.push({ label: acct.label, amount: bal });
      }
    }
  }

  // Opt-in real estate equity only — illiquid homes stay out of accessible by default
  for (const prop of plan.realEstate ?? []) {
    if (!prop.countsTowardAccessibleAssets) continue;
    const equity = realEstateNetEquity(prop);
    if (equity <= 0) continue;
    accessible += equity;
    buckets.push({ label: `${prop.label} (equity)`, amount: equity });
  }

  // Opt-in other personal assets (cars, art, etc.)
  for (const asset of plan.otherAssets ?? []) {
    if (!asset.countsTowardAccessibleAssets) continue;
    const value = Math.max(0, asset.estimatedValue);
    if (value <= 0) continue;
    accessible += value;
    buckets.push({ label: asset.label, amount: value });
  }

  return {
    accessible,
    locked,
    need: 0,
    shortfall: 0,
    coveragePct: 0,
    buckets,
  };
}

function inflatedGapInsuranceTotal(plan: RetirementPlan): number {
  const retirementAge = plan.primary.retirementAge;
  const medicareAge = plan.primary.medicareStartAge;
  const monthly = plan.taxStrategy.monthlyInsuranceUntilMedicare ?? 0;
  if (monthly <= 0 || retirementAge >= medicareAge) return 0;

  const inflation = plan.assumptions.inflationRate;
  let total = 0;
  for (let age = retirementAge; age < medicareAge; age++) {
    const yearIndex = age - plan.primary.currentAge;
    total += monthly * 12 * Math.pow(1 + inflation, yearIndex);
  }
  return total;
}

function buildTimeline(plan: RetirementPlan, firstIncome: GuaranteedIncomeSource): RampTimelineMarker[] {
  const markers: RampTimelineMarker[] = [
    { age: plan.primary.currentAge, label: 'Now', kind: 'now' },
    { age: plan.primary.retirementAge, label: 'Retire', kind: 'retire' },
  ];

  if (
    IRA_PENALTY_FREE_AGE > plan.primary.currentAge &&
    IRA_PENALTY_FREE_AGE < plan.primary.lifeExpectancy
  ) {
    markers.push({ age: IRA_PENALTY_FREE_AGE, label: '59½', kind: 'penaltyFree' });
  }

  if (plan.primary.medicareStartAge > plan.primary.currentAge) {
    markers.push({
      age: plan.primary.medicareStartAge,
      label: 'Medicare',
      kind: 'medicare',
    });
  }

  for (const ss of plan.socialSecurity) {
    if (ss.claimAge > plan.primary.currentAge) {
      const who = ss.owner === 'primary' ? 'SS' : 'Spouse SS';
      markers.push({ age: ss.claimAge, label: who, kind: 'ss' });
    }
  }

  if (
    firstIncome.age > plan.primary.retirementAge &&
    !markers.some((m) => m.age === firstIncome.age && m.kind === 'ss')
  ) {
    markers.push({
      age: firstIncome.age,
      label: firstIncome.label.length > 20 ? 'Income' : firstIncome.label,
      kind: 'income',
    });
  }

  return markers.sort((a, b) => a.age - b.age);
}

function evaluateRunway(
  plan: RetirementPlan,
  projection: ReturnType<typeof projectCashflow>,
  retirementAge: number,
  firstIncome: GuaranteedIncomeSource,
  runwayYears: number,
  annualSpend: number
): RampPillarResult {
  if (runwayYears <= 0) {
    return {
      id: 'runway',
      label: 'Runway',
      status: 'na',
      headline: 'No portfolio-only runway',
      metrics: [
        { label: 'Runway years', value: '0' },
        { label: 'Next income', value: `${firstIncome.label} at ${firstIncome.age}` },
      ],
      detail:
        'You retire when your first guaranteed income starts (or immediately). The portfolio is not your sole funding source for an extended bridge.',
      remediation: [],
    };
  }

  const portfolioSpend = portfolioOnlySpendInRange(
    projection.years,
    retirementAge,
    firstIncome.age
  );
  const { hasShortfall, shortfallYears } = runwayShortfallInRange(
    projection.years,
    retirementAge,
    firstIncome.age
  );
  const pass = !hasShortfall;

  return {
    id: 'runway',
    label: 'Runway',
    status: pass ? 'pass' : 'fail',
    headline: pass
      ? `${runwayYears} year${runwayYears === 1 ? '' : 's'} — portfolio covers the gap`
      : `Shortfall in ${shortfallYears} runway year${shortfallYears === 1 ? '' : 's'}`,
    metrics: [
      { label: 'Runway years', value: String(runwayYears) },
      { label: 'Portfolio-only spend', value: formatMoney(portfolioSpend) },
      { label: 'Next income', value: `${firstIncome.label} @ ${firstIncome.age}` },
      { label: 'Annual spend (today $)', value: formatMoney(annualSpend) },
    ],
    detail: pass
      ? `From age ${retirementAge} to ${firstIncome.age}, your portfolio must fund spending until ${firstIncome.label} begins. The deterministic projection shows no unfunded shortfalls in that window.`
      : `From age ${retirementAge} to ${firstIncome.age}, the portfolio is the primary funding source, but the projection shows unfunded spending in ${shortfallYears} year(s).`,
    remediation: pass
      ? []
      : [
          'Delay retirement until the projection clears shortfalls',
          'Add bridge income (part-time work, pension, rental)',
          'Reduce retirement spending in Income & Expenses',
          'Increase savings or shift toward accessible accounts before retiring',
        ],
  };
}

function evaluateAccessible(
  plan: RetirementPlan,
  projection: ReturnType<typeof projectCashflow>,
  retirementAge: number,
  firstIncome: GuaranteedIncomeSource,
  breakdown: RampAccessibleBreakdown
): { pillar: RampPillarResult; breakdown: RampAccessibleBreakdown } {
  if (retirementAge >= IRA_PENALTY_FREE_AGE) {
    return {
      pillar: {
        id: 'accessible',
        label: 'Accessible assets',
        status: 'na',
        headline: 'Retiring at or after 59½',
        metrics: [{ label: 'Penalty-free age', value: '59½' }],
        detail:
          'You retire at or after age 59½, so pre-penalty access to tax-advantaged accounts is not a constraint.',
        remediation: [],
      },
      breakdown,
    };
  }

  const pre59End = Math.min(firstIncome.age, IRA_PENALTY_FREE_AGE);
  const need = portfolioOnlySpendInRange(projection.years, retirementAge, pre59End);
  const needWithBuffer = need * ACCESSIBLE_BUFFER;
  const shortfall = Math.max(0, needWithBuffer - breakdown.accessible);
  const coveragePct = needWithBuffer > 0 ? (breakdown.accessible / needWithBuffer) * 100 : 100;
  const pass = breakdown.accessible >= needWithBuffer;

  const updatedBreakdown: RampAccessibleBreakdown = {
    ...breakdown,
    need: needWithBuffer,
    shortfall,
    coveragePct,
  };

  const pre59Years = pre59End - retirementAge;

  return {
    pillar: {
      id: 'accessible',
      label: 'Accessible assets',
      status: pass ? 'pass' : 'fail',
      headline: pass
        ? `${coveragePct.toFixed(0)}% of pre-59½ need covered`
        : `${formatMoney(shortfall)} short of penalty-free funds`,
      metrics: [
        { label: 'Accessible at retirement', value: formatMoney(breakdown.accessible) },
        { label: 'Need through 59½ window', value: formatMoney(needWithBuffer) },
        { label: 'Locked (pre-59½)', value: formatMoney(breakdown.locked) },
        { label: 'Pre-59½ years', value: pre59Years.toFixed(1) },
      ],
      detail: pass
        ? `You have enough penalty-free assets (brokerage, cash, Roth contributions) to cover portfolio-only spending for ~${pre59Years.toFixed(1)} years until age ${pre59End}.`
        : `Of your total balance, only ${formatMoney(breakdown.accessible)} is accessible before 59½ without penalty — but you need ~${formatMoney(needWithBuffer)} (incl. 5% buffer) to fund the pre-59½ window. This is an access problem, not necessarily a savings problem.`,
      remediation: pass
        ? []
        : [
            'Shift future savings toward brokerage and HYSA (asset location)',
            'Start a Roth conversion ladder 5+ years before retirement',
            'Enter Roth contribution basis in Assets for accurate counts',
            'Rule of 55: if leaving employer at 55+, 401(k) may be accessible — verify with your plan',
            '72(t) SEPP: fixed withdrawals from IRA before 59½ — setup required ahead of time',
          ],
    },
    breakdown: updatedBreakdown,
  };
}

function evaluateMedical(
  plan: RetirementPlan,
  annualSpend: number
): RampPillarResult {
  const retirementAge = plan.primary.retirementAge;
  const medicareAge = plan.primary.medicareStartAge;
  const gapYears = Math.max(0, medicareAge - retirementAge);
  const monthly = plan.taxStrategy.monthlyInsuranceUntilMedicare ?? 0;
  const totalGapCost = inflatedGapInsuranceTotal(plan);

  if (gapYears <= 0) {
    return {
      id: 'medical',
      label: 'Medical',
      status: 'na',
      headline: 'No pre-Medicare gap',
      metrics: [{ label: 'Medicare starts', value: `Age ${medicareAge}` }],
      detail: 'You retire at or after Medicare eligibility — no private insurance bridge is required.',
      remediation: [],
    };
  }

  const pass = monthly > 0;
  const premiumLow = monthly > 0 && annualSpend > 0 && (monthly * 12) / annualSpend < 0.05;
  const status: RampPillarStatus = pass ? (premiumLow ? 'warn' : 'pass') : 'fail';

  return {
    id: 'medical',
    label: 'Medical',
    status,
    headline: pass
      ? premiumLow
        ? 'Coverage set — premium may be low'
        : `${formatMoney(monthly)}/mo until Medicare`
      : 'No health insurance budget set',
    metrics: [
      { label: 'Gap years', value: String(gapYears) },
      { label: 'Monthly premium', value: monthly > 0 ? formatMoney(monthly) : '—' },
      { label: 'Total gap cost (inflated)', value: formatMoney(totalGapCost) },
    ],
    detail: pass
      ? premiumLow
        ? `A ${formatMoney(monthly)}/mo premium is in the plan, but it is under 5% of annual spending — confirm ACA or private rates for your situation.`
        : `Health insurance from age ${retirementAge} to ${medicareAge} is budgeted at ${formatMoney(monthly)}/mo (${formatMoney(monthly * 12)}/yr) and included in projections.`
      : `You retire ${gapYears} year(s) before Medicare at ${medicareAge}, but monthly insurance is $0. Set a realistic premium in Tax Strategy.`,
    remediation: pass
      ? premiumLow
        ? ['Review ACA marketplace rates for your state and age band', 'Update monthly insurance in Tax Strategy']
        : []
      : [
          'Set "Monthly Insurance Until Medicare" in Tax Strategy (default $750)',
          'Confirm ACA subsidies and state exchange options',
          'Factor premiums into retirement spending if not already',
        ],
  };
}

function evaluatePortfolio(
  plan: RetirementPlan,
  projection: ReturnType<typeof projectCashflow>,
  retirementAge: number,
  annualSpend: number
): RampPillarResult {
  const retYear = yearAtAge(projection.years, retirementAge);
  const spendWithInsurance = annualSpend + (plan.taxStrategy.monthlyInsuranceUntilMedicare ?? 0) * 12;
  const cashLikeAtRetirement = retYear ? retYear.cash + retYear.bonds : 0;
  const bitcoinAtRetirement = retYear?.bitcoin ?? 0;
  const runway = computeRunway(
    plan,
    [
      { type: 'hysa', balance: retYear?.cash ?? 0 },
      { type: 'cd', balance: 0 },
      { type: 'bond', balance: retYear?.bonds ?? 0 },
      { type: 'bitcoin', balance: bitcoinAtRetirement },
    ],
    spendWithInsurance,
    undefined,
    { includeBitcoin: true }
  );
  const bufferYears = runway.bufferYears;
  const liquidAtRetirement = runway.liquidUsd;

  const downYearPolicy =
    (plan.taxStrategy.downYearExpenseCut ?? 0) > 0 &&
    plan.taxStrategy.favorCashInDownYears !== false;

  const stressProjection = projectCashflow(plan, {
    quiet: true,
    returnsForYear: (yearIndex, accounts) => {
      const age = plan.primary.currentAge + yearIndex;
      const yearsAfterRetire = age - retirementAge;
      if (yearsAfterRetire < 0 || yearsAfterRetire >= STRESS_YEARS_AFTER_RETIRE) return {};
      const byAccountId: Record<string, number> = {};
      for (const acct of accounts) {
        if (
          acct.type === 'traditionalIra' ||
          acct.type === 'rothIra' ||
          acct.type === 'traditional401k' ||
          acct.type === 'roth401k' ||
          acct.type === 'brokerage'
        ) {
          byAccountId[acct.id] = STRESS_EQUITY_RETURN;
        }
      }
      return { byAccountId };
    },
  });

  let stressShortfallYears = 0;
  for (const y of stressProjection.years) {
    if (!y.isRetired) continue;
    if (y.age - retirementAge >= SEQUENCE_RISK_YEARS) break;
    if (y.shortfall > 1) stressShortfallYears++;
  }

  const bufferOk = bufferYears >= MIN_BUFFER_YEARS;
  const stressOk = stressShortfallYears === 0;
  const pass = bufferOk && downYearPolicy && stressOk;

  const failedChecks: string[] = [];
  if (!bufferOk) failedChecks.push(`liquid buffer (${bufferYears.toFixed(1)} yrs < ${MIN_BUFFER_YEARS})`);
  if (!downYearPolicy) failedChecks.push('down-year spending policy');
  if (!stressOk) failedChecks.push(`stress test (${stressShortfallYears} shortfall yr(s))`);

  const harvestOn = athHarvestPolicyEnabled(plan) || allocationTrimEnabled(plan);
  const totalHarvested = projection.totalCryptoHarvested ?? 0;

  return {
    id: 'portfolio',
    label: 'Portfolio risk',
    status: pass ? 'pass' : 'fail',
    headline: pass
      ? `${bufferYears.toFixed(1)} yrs liquid buffer — stress test OK`
      : `Fix: ${failedChecks.join(', ')}`,
    metrics: [
      { label: 'Liquid at retirement', value: formatMoney(liquidAtRetirement) },
      ...(bitcoinAtRetirement > 0
        ? [
            { label: 'of which Bitcoin', value: formatMoney(bitcoinAtRetirement) },
            { label: 'Cash + bonds', value: formatMoney(cashLikeAtRetirement) },
          ]
        : []),
      { label: 'Buffer years', value: bufferYears.toFixed(1) },
      { label: 'Down-year policy', value: downYearPolicy ? 'Enabled' : 'Disabled' },
      { label: 'Stress shortfalls', value: String(stressShortfallYears) },
      ...(harvestOn
        ? [{ label: 'BTC/crypto → HYSA (lifetime)', value: formatMoney(totalHarvested) }]
        : []),
    ],
    detail: pass
      ? `Cash, bonds, and Bitcoin cover ~${bufferYears.toFixed(1)} years of spending at retirement (${formatMoney(cashLikeAtRetirement)} cash-like${bitcoinAtRetirement > 0 ? ` + ${formatMoney(bitcoinAtRetirement)} BTC` : ''}). Down-year cuts are enabled, and a −20% equity shock in the first two retired years does not create shortfalls in the first ${SEQUENCE_RISK_YEARS} years.${harvestOn && totalHarvested > 0 ? ` The plan moved ${formatMoney(totalHarvested)} net from BTC/crypto sales into HYSA.` : ''}`
      : `Early retirement sequence risk: ${!bufferOk ? `only ${bufferYears.toFixed(1)} years of liquid reserves including Bitcoin (target ${MIN_BUFFER_YEARS}+). ` : ''}${!downYearPolicy ? 'Down-year expense cuts or cash-first withdrawals are not enabled. ' : ''}${!stressOk ? `A −20% market drop right after retiring causes ${stressShortfallYears} unfunded year(s) in the first ${SEQUENCE_RISK_YEARS}. ` : ''}${!bufferOk && cashLikeAtRetirement < liquidAtRetirement ? `Cash + bonds alone are ${spendWithInsurance > 0 ? (cashLikeAtRetirement / spendWithInsurance).toFixed(1) : '0'} years — the Bitcoin playbook can refill HYSA from alts. ` : ''}`,
    remediation: pass
      ? []
      : [
          harvestOn
            ? 'Review the Bitcoin sell playbook (near-ATH harvest, balanced trim, or both)'
            : 'Open the Bitcoin section and pick a sell playbook so alts can refill HYSA',
          'Or seed HYSA / CD / bonds if you want a cash sleeve separate from Bitcoin',
          'Enable down-year expense cuts and cash-first withdrawals in Tax Strategy',
          'Reduce equity allocation if retiring into a long portfolio-only runway',
        ],
  };
}

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function countActiveChecks(pillars: RampPillarResult[]): { passed: number; total: number } {
  const active = pillars.filter((p) => p.status !== 'na');
  const passed = active.filter((p) => p.status === 'pass' || p.status === 'warn').length;
  return { passed, total: active.length };
}

export function analyzeRamp(
  plan: RetirementPlan,
  options: {
    projection?: ProjectionResult;
    pathMode?: 'deterministic' | 'average';
    mcRuns?: number;
    mcSuccessRate?: number;
    medianEndingBalance?: number;
  } = {}
): RampResult {
  const retirementAge = plan.primary.retirementAge;
  const firstIncome = firstGuaranteedIncome(plan);
  const runwayYears = Math.max(0, firstIncome.age - retirementAge);
  const annualSpend = plannedRetirementSpend(plan);

  const projection = options.projection ?? projectCashflow(plan, { quiet: true });
  const retYear = yearAtAge(projection.years, retirementAge);
  let breakdown = accessibleBalancesAtRetirement(plan, retYear);

  const runway = evaluateRunway(
    plan,
    projection,
    retirementAge,
    firstIncome,
    runwayYears,
    annualSpend
  );
  const accessibleEval = evaluateAccessible(plan, projection, retirementAge, firstIncome, breakdown);
  breakdown = accessibleEval.breakdown;
  const medical = evaluateMedical(plan, annualSpend);
  const portfolio = evaluatePortfolio(plan, projection, retirementAge, annualSpend);

  const pillars = [runway, accessibleEval.pillar, medical, portfolio];
  const { passed, total } = countActiveChecks(pillars);
  const failedPillars = pillars
    .filter((p) => p.status === 'fail')
    .map((p) => p.id);

  const overall: 'pass' | 'fail' = failedPillars.length === 0 ? 'pass' : 'fail';

  const harvestYearsOnRunway = projection.years
    .filter((y) => (y.cryptoHarvestToCash ?? 0) > 0)
    .map((y) => ({
      age: y.age,
      amount: y.cryptoHarvestToCash,
      grossUsd: y.harvestGrossUsd ?? 0,
      taxUsd: y.harvestTaxUsd ?? 0,
      bitcoinUsd: y.bitcoinHarvestUsd ?? 0,
      bitcoinBtc: y.bitcoinHarvestBtc ?? null,
      bitcoinPriceUsd: y.bitcoinPriceUsd ?? null,
      cryptoUsd: y.cryptoHarvestUsd ?? 0,
      goldUsd: y.goldHarvestUsd ?? 0,
      silverUsd: y.silverHarvestUsd ?? 0,
    }));

  return {
    overall,
    passedCount: passed,
    totalChecks: total,
    failedPillars,
    runway,
    accessible: accessibleEval.pillar,
    medical,
    portfolio,
    timeline: buildTimeline(plan, firstIncome),
    accessibleBreakdown: breakdown,
    retirementAge,
    firstGuaranteedIncomeAge: firstIncome.age,
    firstGuaranteedIncomeLabel: firstIncome.label,
    runwayYears,
    annualSpendAtRetirement: annualSpend,
    pathMode: options.pathMode ?? 'deterministic',
    mcRuns: options.mcRuns,
    mcSuccessRate: options.mcSuccessRate,
    medianEndingBalance: options.medianEndingBalance,
    cryptoHarvestOnPath: projection.totalCryptoHarvested ?? 0,
    harvestYearsOnRunway,
  };
}

export interface RampAverageProgress {
  completed: number;
  total: number;
  message: string;
}

/**
 * Run a light Monte Carlo, pick the path whose ending balance is closest to the
 * median (the “average expectation” scenario), and evaluate RAMP on that path.
 * Captures sequence-of-returns and BTC/crypto → HYSA harvest behavior.
 */
export async function analyzeRampAveragePath(
  plan: RetirementPlan,
  options: {
    runs?: number;
    seed?: number;
    onProgress?: (p: RampAverageProgress) => void;
    shouldCancel?: () => boolean;
  } = {}
): Promise<RampResult> {
  const runs = Math.max(50, Math.min(options.runs ?? RAMP_MC_RUNS, 1000));
  const rng = createRng(options.seed ?? Date.now());

  const endings: number[] = [];
  const paths: ProjectionResult[] = [];
  let successCount = 0;

  options.onProgress?.({
    completed: 0,
    total: runs,
    message: 'Sampling return sequences…',
  });

  for (let i = 0; i < runs; i++) {
    if (options.shouldCancel?.()) throw new DOMException('Analysis cancelled', 'AbortError');

    const sampler = makeReturnSampler(plan, rng);
    const result = projectCashflow(plan, { returnsForYear: sampler.sample, quiet: true });
    endings.push(result.endingBalance);
    paths.push(result);
    if (!result.failed) successCount++;

    if (i % 20 === 0 || i === runs - 1) {
      options.onProgress?.({
        completed: i + 1,
        total: runs,
        message: `Path ${i + 1} of ${runs}…`,
      });
      // Yield so the UI can paint progress
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  if (options.shouldCancel?.()) throw new DOMException('Analysis cancelled', 'AbortError');
  if (paths.length === 0) {
    return analyzeRamp(plan, { pathMode: 'deterministic' });
  }

  const sorted = [...endings].sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)]!;
  let bestIdx = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < endings.length; i++) {
    const d = Math.abs(endings[i]! - mid);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  const medianPath = paths[bestIdx]!;
  options.onProgress?.({
    completed: runs,
    total: runs,
    message: 'Evaluating RAMP on median path…',
  });

  return analyzeRamp(plan, {
    projection: medianPath,
    pathMode: 'average',
    mcRuns: endings.length,
    mcSuccessRate: endings.length > 0 ? successCount / endings.length : 0,
    medianEndingBalance: mid,
  });
}
