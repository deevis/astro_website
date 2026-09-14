import type { Account, AccountType, RetirementPlan } from './types';
import { validatePlan } from './planValidation';
import {
  expenseCategoryOf,
  healthPremiumsAtAge,
  incomeEndsAtRetirement,
  realEstateCarryingCostAtAge,
  realEstateNetIncomeAtAge,
  remainingCalendarYearFraction,
  workFractionInCalendarYear,
  type PersonProfile,
} from './types';
import { rmdStartAge } from './rmd';
import {
  bitcoinProjectionReturn,
  usesBitcoinPricingModel,
} from './bitcoinPricingModels';
import {
  type MutableAccount,
  sumByType,
  isUnitPriced,
  syncUnitBalance,
  contributeToAccount,
  withdrawWithDetail,
} from './accountOps';
import {
  harvestAthAltsToCash,
  trimAltsToCash,
  updateAltHighWaterMarks,
  initialAltHighWaterMark,
  spendingWithdrawalOrder,
  applySpendingCut,
  performRothConversion,
  executeRmdPolicy,
  rothBeforeRmd,
  POLICY_IDS,
} from './policies';
import {
  createYearLedger,
  pushEvent,
  type YearEventLedger,
  type SimulationEvent,
} from './events';
import { computeAnnualTax, type AnnualTaxInputs } from './tax/federalTaxEngine';
import {
  addSpend,
  emptySpend,
  scaleSpend,
  snapshotAccounts,
  type AccountYearSnapshot,
  type SpendBreakdown,
} from './forensic';
import {
  createSimulationRequest,
  simulationMetaFromRequest,
  type SimulationMeta,
} from './simulation';

export type { MutableAccount } from './accountOps';

export interface ProjectionYear {
  age: number;
  yearIndex: number;
  /** Calendar year approx */
  calendarYear: number;
  income: number;
  socialSecurity: number;
  expenses: number;
  contributions: number;
  withdrawals: number;
  rmd: number;
  /** Traditional → Roth conversion this year */
  rothConversion: number;
  portfolioTotal: number;
  traditional: number;
  roth: number;
  brokerage: number;
  crypto: number;
  bitcoin: number;
  gold: number;
  silver: number;
  /** HYSA + CD balances */
  cash: number;
  bonds: number;
  shortfall: number;
  isRetired: boolean;
  isRmdYear: boolean;
  primaryRmdStarts: boolean;
  spouseRmdStarts: boolean;
  /** Realized weighted portfolio return this year (after growth, before withdrawals) */
  portfolioReturn: number;
  /**
   * Value-weighted return of equity-like accounts (IRA/Roth/brokerage) this year,
   * or null if none were held before growth.
   */
  marketReturn: number | null;
  /** Value-weighted Bitcoin return, or null if none held */
  bitcoinReturn: number | null;
  /** Value-weighted crypto (non-BTC) return, or null if none held */
  cryptoReturn: number | null;
  goldReturn: number | null;
  silverReturn: number | null;
  /** Portfolio return points attributable to equities (weight × market return) */
  marketContribution: number;
  bitcoinContribution: number;
  cryptoContribution: number;
  goldContribution: number;
  silverContribution: number;
  /** True when portfolio return was negative and down-year strategies applied */
  downYear: boolean;
  /** Expense dollars cut due to down-year policy */
  expenseCut: number;
  /** Net alt proceeds moved into HYSA (ATH harvest and/or balanced trim) */
  cryptoHarvestToCash: number;
  /** Gross proceeds before tax on ATH harvest sales */
  harvestGrossUsd: number;
  /** Estimated federal CG tax withheld from ATH harvest */
  harvestTaxUsd: number;
  /** True when at least one ATH harvest sale occurred */
  athHarvest: boolean;
  /** True when a balanced-trim sale occurred this year */
  altTrim: boolean;
  /** USD harvested from Bitcoin accounts this year */
  bitcoinHarvestUsd: number;
  /** BTC units sold this year (null if units not tracked) */
  bitcoinHarvestBtc: number | null;
  /** Modeled BTC spot price used for the sale this year */
  bitcoinPriceUsd: number | null;
  /** USD harvested from non-BTC crypto this year */
  cryptoHarvestUsd: number;
  goldHarvestUsd: number;
  silverHarvestUsd: number;
  /** Estimated federal tax for the year */
  estimatedTax?: number;
  magi?: number;
  /** Spending by category after down-year cuts */
  spend?: SpendBreakdown;
  /** Account balances at the start of the year (before contributions/growth) */
  accountsStart?: AccountYearSnapshot[];
  /** Account balances at the end of the year */
  accountsEnd?: AccountYearSnapshot[];
  /** Decision audit trail for this year */
  events?: SimulationEvent[];
}

export interface ProjectionResult {
  years: ProjectionYear[];
  endingBalance: number;
  depletedAge: number | null;
  primaryRmdAge: number;
  spouseRmdAge: number | null;
  maxAge: number;
  warnings: string[];
  failed: boolean;
  totalRothConverted: number;
  totalExpenseCuts: number;
  totalCryptoHarvested: number;
  /** Per-year event ledgers for explainability */
  ledgers: YearEventLedger[];
  simulationMeta?: SimulationMeta;
}

function inflate(amount: number, rate: number, years: number): number {
  return amount * Math.pow(1 + rate, years);
}

function isActiveAge(age: number, startAge: number, endAge: number | null): boolean {
  if (age < startAge) return false;
  if (endAge != null && age > endAge) return false;
  return true;
}

function ownerAge(plan: RetirementPlan, owner: Account['owner'], primaryAge: number): number {
  if (owner === 'spouse' && plan.spouse) {
    const delta = plan.spouse.currentAge - plan.primary.currentAge;
    return primaryAge + delta;
  }
  return primaryAge;
}

function ownerPerson(plan: RetirementPlan, owner: Account['owner']): PersonProfile {
  if (owner === 'spouse' && plan.spouse) return plan.spouse;
  return plan.primary;
}

function workFractionForOwner(
  plan: RetirementPlan,
  owner: Account['owner'],
  asOf: Date,
  calendarYear: number
): number {
  const person = ownerPerson(plan, owner);
  return workFractionInCalendarYear(
    person.currentAge,
    person.retirementAge,
    person.birthMonth,
    asOf,
    calendarYear
  );
}

function ssIncomeTodayDollars(
  plan: RetirementPlan,
  owner: 'primary' | 'spouse',
  personAge: number,
  yearIndex: number,
  inflation: number
): number {
  const ss = plan.socialSecurity.find((s) => s.owner === owner);
  if (!ss || personAge < ss.claimAge) return 0;
  const monthly = ss.estimatedMonthlyBenefit ?? 0;
  if (monthly <= 0) return 0;
  return inflate(monthly * 12, inflation, yearIndex);
}

function isAltHarvestType(type: AccountType): boolean {
  return type === 'bitcoin' || type === 'crypto' || type === 'gold' || type === 'silver';
}

export interface ReturnOverrides {
  /** Per-account return for this year (decimal). Falls back to account.expectedReturn. */
  byAccountId?: Record<string, number>;
}

export interface SimulateOptions {
  returnsForYear?: (yearIndex: number, accounts: MutableAccount[]) => ReturnOverrides;
  /** When true, skip warning generation (Monte Carlo paths). */
  quiet?: boolean;
  /** Optional seed for reproducibility metadata */
  seed?: number;
  /**
   * Clock used to size the first projection year. Year 0 market returns and
   * remaining salary are scaled from this date so a September run does not
   * apply a full January–December year to today’s balances or leftover pay.
   */
  asOfDate?: Date;
  /** Set false in tests that assert full calendar-year growth in year 0. Default true. */
  stubFirstYearReturns?: boolean;
}

export { remainingCalendarYearFraction } from './types';

/** Convert an annual simple return into a stub-period simple return. */
export function stubYearReturn(annualReturn: number, fraction: number): number {
  if (!Number.isFinite(annualReturn) || fraction >= 0.999) return annualReturn;
  if (fraction <= 0) return 0;
  const growth = 1 + annualReturn;
  if (growth <= 0) return -1;
  return Math.pow(growth, fraction) - 1;
}

function retirementSpendProxy(plan: RetirementPlan): number {
  if (!plan.assumptions.useSpendFromPlan || plan.expenses.length === 0) {
    const start = plan.accounts.reduce((s, a) => s + a.balance, 0);
    return start * plan.assumptions.withdrawalRate;
  }
  let total = 0;
  for (const e of plan.expenses) {
    total += e.retirementAnnualAmount != null ? e.retirementAnnualAmount : e.annualAmount;
  }
  return total;
}

export function projectCashflow(
  plan: RetirementPlan,
  options: SimulateOptions = {}
): ProjectionResult {
  validatePlan(plan);
  const warnings: string[] = [];
  const inflation = plan.assumptions.inflationRate;
  const startAge = plan.primary.currentAge;
  // Convert spouse longevity into primary-age coordinates before setting the horizon.
  const maxAge = Math.max(plan.primary.lifeExpectancy, plan.spouse
    ? startAge + plan.spouse.lifeExpectancy - plan.spouse.currentAge : startAge);
  const asOf = options.asOfDate ?? new Date();
  const startYear = asOf.getFullYear();
  const firstYearReturnFraction =
    options.stubFirstYearReturns === false
      ? 1
      : remainingCalendarYearFraction(asOf);
  const simRequest = createSimulationRequest(plan, {
    quiet: options.quiet,
    seed: options.seed,
  });
  const simSeed = options.seed ?? 0;

  const primaryRmdAge = rmdStartAge(plan.primary.currentAge);
  const spouseRmdAge = plan.spouse ? rmdStartAge(plan.spouse.currentAge) : null;

  if (
    !options.quiet &&
    plan.socialSecurity.some((s) => s.earningsHistory.length > 0 && !s.estimatedMonthlyBenefit)
  ) {
    warnings.push(
      'Social Security earnings are entered but benefits are not calculated yet — run Calculate benefits in the Social Security section.'
    );
  }

  const accounts: MutableAccount[] = plan.accounts.map((a) => {
    const base: MutableAccount = {
      id: a.id,
      type: a.type,
      owner: a.owner,
      balance: Math.max(0, a.balance),
      annualContribution: Math.max(0, a.annualContribution),
      expectedReturn: a.expectedReturn,
      employerMatchAnnual: Math.max(0, a.employerMatchAnnual ?? 0),
    };
    if (a.costBasisUsd != null && a.costBasisUsd >= 0) {
      base.costBasisUsd = a.costBasisUsd;
    }
    if (isUnitPriced(a.type)) {
      if (a.assetUnits != null && a.assetUnits >= 0) base.assetUnits = a.assetUnits;
      if (a.spotPriceUsd != null && a.spotPriceUsd > 0) base.spotPriceUsd = a.spotPriceUsd;
      if (base.assetUnits == null && base.spotPriceUsd != null && base.balance > 0) {
        base.assetUnits = base.balance / base.spotPriceUsd;
      } else if (base.spotPriceUsd == null && base.assetUnits != null && base.assetUnits > 0) {
        base.spotPriceUsd = base.balance / base.assetUnits;
      }
      if (base.assetUnits != null && base.spotPriceUsd != null) {
        base.balance = base.assetUnits * base.spotPriceUsd;
      }
    }
    return base;
  });

  if (!options.quiet && accounts.length === 0) {
    warnings.push('No accounts added — projection will only show income vs expenses.');
  }

  const hwmByAccountId: Record<string, number> = {};
  const cryptoRefBalance: Record<string, number> = {};
  for (const acct of accounts) {
    if (!isAltHarvestType(acct.type)) continue;
    const initialHwm = initialAltHighWaterMark(plan, acct);
    if (initialHwm > 0) {
      hwmByAccountId[acct.id] = initialHwm;
    }
    // A total-return index must not move when units are contributed or sold.
    cryptoRefBalance[acct.id] = 1;
  }

  const years: ProjectionYear[] = [];
  const ledgers: YearEventLedger[] = [];
  let depletedAge: number | null = null;
  let failed = false;
  let totalRothConverted = 0;
  let totalExpenseCuts = 0;
  let totalCryptoHarvested = 0;

  const downYearCut = plan.taxStrategy.downYearExpenseCut ?? 0.1;
  const favorCash = plan.taxStrategy.favorCashInDownYears !== false;
  const filing = plan.filingStatus === 'married' ? 'married' : 'single';

  const btcPricingModel = plan.assumptions.bitcoinPricingModel ?? 'amalgam';
  if (!options.quiet && accounts.some((a) => a.type === 'bitcoin' && !a.spotPriceUsd)) {
    warnings.push('Enter a Bitcoin spot price in Assets to enable market-ATH harvesting, balanced trim quantities, and BTC sale units. Dollar-only balances still follow the selected price path.');
  }

  const accountLabels: Record<string, string> = Object.fromEntries(
    plan.accounts.map((a) => [a.id, a.label || a.type])
  );

  for (let age = startAge; age <= maxAge; age++) {
    const yearIndex = age - startAge;
    const calendarYear = startYear + yearIndex;
    const inflationFactor = Math.pow(1 + inflation, yearIndex);
    const isRetired = age >= plan.primary.retirementAge;
    const ledger = createYearLedger(age, calendarYear);
    const accountsStart = snapshotAccounts(accounts, accountLabels);
    const priorYearBalances = Object.fromEntries(accountsStart.map((a) => [a.id, a.balanceUsd]));
    const marketReturnById: Record<string, number> = {};

    // --- Contributions ---
    let contributions = 0;
    for (const acct of accounts) {
      const workFrac = workFractionForOwner(plan, acct.owner, asOf, calendarYear);
      if (acct.annualContribution > 0 && workFrac > 0) {
        const contrib = inflate(acct.annualContribution, inflation, yearIndex) * workFrac;
        contributeToAccount(acct, contrib);
        contributions += contrib;
        pushEvent(ledger, {
          kind: 'Contribution',
          age,
          calendarYear,
          policyId: 'engine',
          reason: 'Annual contribution',
          accountId: acct.id,
          amount: contrib,
        });
      }
      const matchAnnual = acct.employerMatchAnnual ?? 0;
      if (matchAnnual > 0 && workFrac > 0) {
        const match = inflate(matchAnnual, inflation, yearIndex) * workFrac;
        contributeToAccount(acct, match);
        contributions += match;
        pushEvent(ledger, {
          kind: 'Contribution',
          age,
          calendarYear,
          policyId: 'engine',
          reason: 'Employer match',
          accountId: acct.id,
          amount: match,
        });
      }
    }

    // --- Growth ---
    const beforeGrowth = accounts.reduce((s, a) => s + a.balance, 0);
    const overrides = options.returnsForYear?.(yearIndex, accounts) ?? {};

    let marketBefore = 0;
    let marketGain = 0;
    let bitcoinBefore = 0;
    let bitcoinGain = 0;
    let cryptoBefore = 0;
    let cryptoGain = 0;
    let goldBefore = 0;
    let goldGain = 0;
    let silverBefore = 0;
    let silverGain = 0;

    for (const acct of accounts) {
      const before = acct.balance;
      const fallbackReturn = acct.type === 'bitcoin' ? plan.assumptions.bitcoinReturn : acct.expectedReturn;
      const modelReturn = acct.type === 'bitcoin' && usesBitcoinPricingModel(btcPricingModel) && !options.returnsForYear
        ? bitcoinProjectionReturn(btcPricingModel, startYear, yearIndex, plan.assumptions.bitcoinAmalgamMix) : null;
      const rawReturn = overrides.byAccountId?.[acct.id] ?? modelReturn ?? fallbackReturn;
      let r = Number.isFinite(rawReturn) ? Math.max(-1, rawReturn) : 0;
      if (yearIndex === 0 && firstYearReturnFraction < 0.999) {
        r = stubYearReturn(r, firstYearReturnFraction);
      }
      marketReturnById[acct.id] = r;

      if (
        isUnitPriced(acct.type) &&
        acct.spotPriceUsd != null &&
        acct.spotPriceUsd > 0 &&
        acct.assetUnits != null
      ) {
        acct.spotPriceUsd = acct.spotPriceUsd * (1 + r);
        acct.balance = acct.assetUnits * acct.spotPriceUsd;
      } else {
        const gain = before * r;
        acct.balance = before + gain;
        if (isUnitPriced(acct.type) && acct.spotPriceUsd != null && acct.spotPriceUsd > 0) {
          acct.spotPriceUsd = acct.spotPriceUsd * (1 + r);
          if (acct.assetUnits == null && before > 0) {
            acct.assetUnits = before / (acct.spotPriceUsd / (1 + r));
          }
          if (acct.assetUnits != null) {
            acct.balance = acct.assetUnits * acct.spotPriceUsd;
          }
        }
      }

      const gain = acct.balance - before;
      if (isAltHarvestType(acct.type)) cryptoRefBalance[acct.id] *= 1 + r;
      if (Math.abs(gain) > 0.01) {
        pushEvent(ledger, {
          kind: 'MarketGrowth',
          age,
          calendarYear,
          policyId: 'world',
          reason: `Return ${(r * 100).toFixed(1)}%`,
          accountId: acct.id,
          accountType: acct.type,
          returnRate: r,
          gain,
          balanceAfter: acct.balance,
        });
      }

      if (acct.type === 'bitcoin') {
        bitcoinBefore += before;
        bitcoinGain += gain;
      } else if (acct.type === 'crypto') {
        cryptoBefore += before;
        cryptoGain += gain;
      } else if (acct.type === 'gold') {
        goldBefore += before;
        goldGain += gain;
      } else if (acct.type === 'silver') {
        silverBefore += before;
        silverGain += gain;
      } else if (
        acct.type === 'traditionalIra' ||
        acct.type === 'rothIra' ||
        acct.type === 'traditional401k' ||
        acct.type === 'roth401k' ||
        acct.type === 'brokerage'
      ) {
        marketBefore += before;
        marketGain += gain;
      }
    }

    const afterGrowth = accounts.reduce((s, a) => s + a.balance, 0);
    const portfolioReturn = beforeGrowth > 0 ? afterGrowth / beforeGrowth - 1 : 0;
    const downYear = portfolioReturn < 0;
    const marketReturn = marketBefore > 0 ? marketGain / marketBefore : null;
    const bitcoinReturn = bitcoinBefore > 0 ? bitcoinGain / bitcoinBefore : null;
    const cryptoReturn = cryptoBefore > 0 ? cryptoGain / cryptoBefore : null;
    const goldReturn = goldBefore > 0 ? goldGain / goldBefore : null;
    const silverReturn = silverBefore > 0 ? silverGain / silverBefore : null;
    const marketContribution = beforeGrowth > 0 ? marketGain / beforeGrowth : 0;
    const bitcoinContribution = beforeGrowth > 0 ? bitcoinGain / beforeGrowth : 0;
    const cryptoContribution = beforeGrowth > 0 ? cryptoGain / beforeGrowth : 0;
    const goldContribution = beforeGrowth > 0 ? goldGain / beforeGrowth : 0;
    const silverContribution = beforeGrowth > 0 ? silverGain / beforeGrowth : 0;

    // --- Income streams ---
    let income = 0;
    let taxableIncome = 0;
    for (const stream of plan.income) {
      const streamAge = ownerAge(plan, stream.owner, age);
      let workFrac = 1;
      if (incomeEndsAtRetirement(stream, plan.income)) {
        if (streamAge < stream.startAge) continue;
        workFrac = workFractionForOwner(plan, stream.owner, asOf, calendarYear);
        if (workFrac <= 0) continue;
      } else if (!isActiveAge(streamAge, stream.startAge, stream.endAge)) {
        continue;
      }
      const amt = inflate(stream.annualAmount, inflation, yearIndex) * workFrac;
      income += amt;
      if (stream.taxable) taxableIncome += amt;
      pushEvent(ledger, {
        kind: 'Income',
        age,
        calendarYear,
        policyId: 'engine',
        reason: stream.label || 'Income',
        amount: amt,
        label: stream.label,
      });
    }

    for (const prop of plan.realEstate ?? []) {
      const noi = realEstateNetIncomeAtAge(prop, age);
      if (noi !== 0) {
        const amt = inflate(noi, inflation, yearIndex);
        income += amt;
        taxableIncome += amt;
        pushEvent(ledger, {
          kind: 'Income',
          age,
          calendarYear,
          policyId: 'engine',
          reason: prop.label || 'Real estate NOI',
          amount: amt,
          label: prop.label,
        });
      }
    }

    // --- Social Security ---
    let socialSecurity = ssIncomeTodayDollars(plan, 'primary', age, yearIndex, inflation);
    if (plan.spouse) {
      const spouseAge = ownerAge(plan, 'spouse', age);
      socialSecurity += ssIncomeTodayDollars(plan, 'spouse', spouseAge, yearIndex, inflation);
    }
    if (socialSecurity > 0) {
      pushEvent(ledger, {
        kind: 'SocialSecurity',
        age,
        calendarYear,
        policyId: 'engine',
        reason: 'Social Security benefits',
        amount: socialSecurity,
      });
    }

    // --- Expenses ---
    const spend = emptySpend();
    if (plan.assumptions.useSpendFromPlan && plan.expenses.length > 0) {
      for (const item of plan.expenses) {
        if (!isActiveAge(age, item.startAge, item.endAge)) continue;
        const retired = age >= plan.primary.retirementAge;
        const base =
          retired && item.retirementAnnualAmount != null
            ? item.retirementAnnualAmount
            : item.annualAmount;
        addSpend(spend, expenseCategoryOf(item), inflate(base, inflation, yearIndex));
      }
    } else if (isRetired) {
      const startPortfolio = plan.accounts.reduce((s, a) => s + a.balance, 0);
      addSpend(spend, 'general', inflate(startPortfolio * plan.assumptions.withdrawalRate, inflation, yearIndex));
    }

    for (const prop of plan.realEstate ?? []) {
      const carrying = realEstateCarryingCostAtAge(prop, age);
      if (carrying > 0) addSpend(spend, 'general', inflate(carrying, inflation, yearIndex));
    }

    for (const asset of plan.otherAssets ?? []) {
      const cost = Math.max(0, asset.annualCost);
      if (cost > 0) addSpend(spend, 'general', inflate(cost, inflation, yearIndex));
    }

    const premiums = healthPremiumsAtAge(plan, age);
    for (const line of premiums.due) {
      addSpend(spend, 'healthInsurance', inflate(line.amount, inflation, yearIndex));
    }

    let expenses = spend.total;
    if (expenses > 0) {
      pushEvent(ledger, {
        kind: 'Expense',
        age,
        calendarYear,
        policyId: 'engine',
        reason: 'Annual spending need',
        amount: expenses,
      });
    }

    const cutResult = applySpendingCut(expenses, downYear, downYearCut);
    let expenseCut = cutResult.cut;
    expenses = cutResult.expenses;
    const spendAfterCut =
      spend.total > 0 && expenseCut > 0 ? scaleSpend(spend, expenses / spend.total) : spend;
    spendAfterCut.total = expenses;
    if (expenseCut > 0) {
      totalExpenseCuts += expenseCut;
      pushEvent(ledger, {
        kind: 'ExpenseCut',
        age,
        calendarYear,
        policyId: POLICY_IDS.spendingAdjustment,
        reason: `Down-year portfolio return ${(portfolioReturn * 100).toFixed(1)}%`,
        amount: expenseCut,
        cutFraction: downYearCut,
      });
    }

    const totalNonPortfolioIncome = income + socialSecurity;
    const harvestIncomeProxy = Math.max(0, taxableIncome + socialSecurity * 0.85);
    const harvest = harvestAthAltsToCash(
      plan, accounts, age, yearIndex, inflation, hwmByAccountId, cryptoRefBalance,
      harvestIncomeProxy, expenses
    );
    for (const sale of harvest.sales) {
      pushEvent(ledger, {
        kind: 'AthHarvestSale', age, calendarYear, policyId: POLICY_IDS.athHarvest,
        reason: sale.reason, accountId: sale.accountId, accountType: sale.accountType,
        grossUsd: sale.gross, gainUsd: sale.gain, taxUsd: sale.tax, netUsd: sale.net,
        unitsSold: sale.unitsSold > 0 ? sale.unitsSold : undefined, priceUsd: sale.price,
      });
    }
    const trim = trimAltsToCash(
      plan, accounts, age, yearIndex, inflation,
      harvestIncomeProxy + harvest.totalGain, expenses
    );
    for (const sale of trim.sales) {
      pushEvent(ledger, {
        kind: 'AthHarvestSale', age, calendarYear, policyId: POLICY_IDS.altTrim,
        reason: sale.reason, accountId: sale.accountId, accountType: sale.accountType,
        grossUsd: sale.gross, gainUsd: sale.gain, taxUsd: sale.tax, netUsd: sale.net,
        unitsSold: sale.unitsSold > 0 ? sale.unitsSold : undefined, priceUsd: sale.price,
      });
    }
    updateAltHighWaterMarks(accounts, hwmByAccountId, cryptoRefBalance);
    const harvestGain = harvest.totalGain + trim.totalGain;
    const harvestNet = harvest.totalNet + trim.totalNet;
    const harvestGross = harvest.totalGross + trim.totalGross;
    const harvestTax = harvest.totalTax + trim.totalTax;
    totalCryptoHarvested += harvestNet;
    let spendingNeed = Math.max(0, expenses - totalNonPortfolioIncome);

    const spouseAgeNow = plan.spouse ? ownerAge(plan, 'spouse', age) : null;
    const primaryHitsRmd = age >= primaryRmdAge;
    const spouseHitsRmd =
      spouseRmdAge != null && spouseAgeNow != null && spouseAgeNow >= spouseRmdAge;

    let rmd = 0;
    let rothConversion = 0;
    let conversionTaxPaid = 0;
    let conversionFundingGains = 0;

    const runRoth = (rmdForRoth: number) => {
      const rothResult = performRothConversion(
        plan,
        accounts,
        age,
        yearIndex,
        inflation,
        taxableIncome,
        socialSecurity,
        rmdForRoth,
        harvestGain
      );
      rothConversion = rothResult.converted;
      conversionTaxPaid = rothResult.estimatedTax;
      conversionFundingGains = rothResult.taxFundingGains ?? 0;
      if (rothConversion > 0) {
        totalRothConverted += rothConversion;
        pushEvent(ledger, {
          kind: 'RothConversion',
          age,
          calendarYear,
          policyId: POLICY_IDS.rothConversion,
          reason: rothResult.reason,
          amount: rothConversion,
          estimatedTax: rothResult.estimatedTax,
        });
      }
    };

    if (rothBeforeRmd(plan)) {
      runRoth(0);
    }

    const rmdResult = executeRmdPolicy(
      plan,
      accounts,
      age,
      primaryRmdAge,
      spouseRmdAge,
      spouseAgeNow,
      spendingNeed,
      priorYearBalances
    );
    rmd = rmdResult.rmd;
    spendingNeed = Math.max(0, spendingNeed - rmdResult.appliedToSpending);

    if (rmdResult.primaryRmd > 0) {
      pushEvent(ledger, {
        kind: 'Rmd',
        age,
        calendarYear,
        policyId: POLICY_IDS.rmd,
        reason: rmdResult.reason,
        amount: rmdResult.primaryRmd,
        appliedToSpending: Math.min(rmdResult.primaryRmd, rmdResult.appliedToSpending),
        surplus: rmdResult.surplus,
        owner: 'primary',
      });
    }
    if (rmdResult.spouseRmd > 0) {
      pushEvent(ledger, {
        kind: 'Rmd',
        age,
        calendarYear,
        policyId: POLICY_IDS.rmd,
        reason: rmdResult.reason,
        amount: rmdResult.spouseRmd,
        appliedToSpending: 0,
        surplus: 0,
        owner: 'spouse',
      });
    }

    if (!rothBeforeRmd(plan)) {
      runRoth(rmd);
    }

    let traditionalSpendWithdrawals = 0;
    let collectiblesGains = harvest.sales.filter((s) => s.accountType === 'gold' || s.accountType === 'silver').reduce((sum, s) => sum + s.gain, 0);
    let ltcgGains = harvestGain - collectiblesGains + conversionFundingGains;
    let spendingWithdrawals = 0;

    if (spendingNeed > 0) {
      const order = spendingWithdrawalOrder(downYear, favorCash);
      const { total, details } = withdrawWithDetail(accounts, order, spendingNeed);
      spendingWithdrawals = total;
      spendingNeed -= total;
      for (const d of details) {
        pushEvent(ledger, {
          kind: 'SpendingWithdraw',
          age,
          calendarYear,
          policyId: POLICY_IDS.withdrawal,
          reason: downYear && favorCash ? 'Down-year cash-first withdrawal' : 'Spending withdrawal',
          accountId: d.accountId,
          accountType: d.accountType,
          amount: d.amount,
        });
        if (d.accountType === 'traditionalIra' || d.accountType === 'traditional401k') {
          traditionalSpendWithdrawals += d.amount;
        }
        if (d.realizedGain != null && d.realizedGain > 0) {
          if (d.accountType === 'gold' || d.accountType === 'silver') collectiblesGains += d.realizedGain;
          else ltcgGains += d.realizedGain;
        }
      }
    }

    let taxWithdrawals = 0;

    const taxInputs: AnnualTaxInputs = {
      filing,
      inflationFactor,
      wagesAndOtherIncome: taxableIncome,
      traditionalWithdrawals: traditionalSpendWithdrawals,
      rothConversion,
      rmd,
      socialSecurityGross: socialSecurity,
      ltcgGains,
      collectiblesGains,
    };
    let annualTax = computeAnnualTax(taxInputs);
    const prepaidTax = harvestTax + conversionTaxPaid;
    const surplusIncome = Math.max(0, totalNonPortfolioIncome - expenses - contributions);
    // Pay taxes from unused income first, then accounts. Taxable withdrawals can
    // themselves create tax, so gross up until the remaining amount is negligible.
    for (let pass = 0; pass < 16; pass++) {
      const taxNeed = Math.max(0, annualTax.totalTax - prepaidTax - surplusIncome - taxWithdrawals);
      if (taxNeed <= 0.01) break;
      const payment = withdrawWithDetail(accounts, spendingWithdrawalOrder(downYear, favorCash), taxNeed);
      taxWithdrawals += payment.total;
      for (const detail of payment.details) {
        if (detail.accountType === 'traditionalIra' || detail.accountType === 'traditional401k') taxInputs.traditionalWithdrawals += detail.amount;
        if (detail.accountType === 'gold' || detail.accountType === 'silver') taxInputs.collectiblesGains += detail.realizedGain ?? 0;
        else taxInputs.ltcgGains += detail.realizedGain ?? 0;
        pushEvent(ledger, { kind: 'SpendingWithdraw', age, calendarYear, policyId: 'tax-engine', reason: 'Federal tax payment', accountId: detail.accountId, accountType: detail.accountType, amount: detail.amount });
      }
      annualTax = computeAnnualTax(taxInputs);
      if (payment.total < 0.01) break;
    }
    const unpaidTax = Math.max(0, annualTax.totalTax - prepaidTax - surplusIncome - taxWithdrawals);
    // Reconcile conservative transaction withholding to the annual estimate.
    const taxRefund = Math.max(0, prepaidTax - annualTax.totalTax);
    if (taxRefund > 0.01) {
      let cashAccount = accounts.find((a) => a.type === 'hysa');
      if (!cashAccount) {
        cashAccount = { id: '__tax_refund_hysa', type: 'hysa', owner: 'primary', balance: 0, annualContribution: 0, expectedReturn: plan.assumptions.cashReturn };
        accounts.push(cashAccount);
      }
      cashAccount.balance += taxRefund;
      pushEvent(ledger, { kind: 'PolicyNote', age, calendarYear, policyId: 'tax-engine', reason: 'Tax reconciliation', note: 'Excess estimated withholding returned to cash: USD ' + taxRefund.toFixed(2) });
    }
    const withdrawals = rmd + spendingWithdrawals + taxWithdrawals + conversionTaxPaid;
    const shortfall = spendingNeed + unpaidTax;
    if (shortfall > 1) failed = true;
    pushEvent(ledger, {
      kind: 'TaxEstimate',
      age,
      calendarYear,
      policyId: 'tax-engine',
      reason: `IRMAA tier ${annualTax.irmaaTier}`,
      ordinaryTax: annualTax.ordinaryTax,
      ltcgTax: annualTax.ltcgTax,
      totalTax: annualTax.totalTax,
      magi: annualTax.magi,
      taxableIncome: annualTax.taxableIncome,
      ssTaxableFraction: annualTax.ssTaxableFraction,
    });

    const traditional =
      sumByType(accounts, 'traditionalIra') + sumByType(accounts, 'traditional401k');
    const roth = sumByType(accounts, 'rothIra') + sumByType(accounts, 'roth401k');
    const brokerage = sumByType(accounts, 'brokerage');
    const crypto = sumByType(accounts, 'crypto');
    const bitcoin = sumByType(accounts, 'bitcoin');
    const gold = sumByType(accounts, 'gold');
    const silver = sumByType(accounts, 'silver');
    const cash = sumByType(accounts, 'hysa') + sumByType(accounts, 'cd');
    const bonds = sumByType(accounts, 'bond');
    const portfolioTotal =
      traditional + roth + brokerage + crypto + bitcoin + gold + silver + cash + bonds;

    if (portfolioTotal <= 1 && shortfall > 1 && depletedAge == null) {
      depletedAge = age;
    }

    ledgers.push(ledger);

    years.push({
      age,
      yearIndex,
      calendarYear,
      income,
      socialSecurity,
      expenses,
      contributions,
      withdrawals,
      rmd,
      rothConversion,
      portfolioTotal,
      traditional,
      roth,
      brokerage,
      crypto,
      bitcoin,
      gold,
      silver,
      cash,
      bonds,
      shortfall,
      isRetired,
      isRmdYear: primaryHitsRmd || Boolean(spouseHitsRmd),
      primaryRmdStarts: age === primaryRmdAge,
      spouseRmdStarts: spouseRmdAge != null && spouseAgeNow === spouseRmdAge,
      portfolioReturn,
      marketReturn,
      bitcoinReturn,
      cryptoReturn,
      goldReturn,
      silverReturn,
      marketContribution,
      bitcoinContribution,
      cryptoContribution,
      goldContribution,
      silverContribution,
      downYear,
      expenseCut,
      cryptoHarvestToCash: harvestNet,
      harvestGrossUsd: harvestGross,
      harvestTaxUsd: harvestTax,
      athHarvest: harvest.athHarvest,
      altTrim: trim.totalNet > 0,
      bitcoinHarvestUsd: harvest.bitcoinUsd + trim.bitcoinUsd,
      bitcoinHarvestBtc:
        harvest.bitcoinBtc == null && trim.bitcoinBtc == null
          ? null
          : (harvest.bitcoinBtc ?? 0) + (trim.bitcoinBtc ?? 0),
      bitcoinPriceUsd: accounts.find((a) => a.type === 'bitcoin' && a.spotPriceUsd != null)?.spotPriceUsd ?? null,
      cryptoHarvestUsd: harvest.cryptoUsd + trim.cryptoUsd,
      goldHarvestUsd: harvest.goldUsd + trim.goldUsd,
      silverHarvestUsd: harvest.silverUsd + trim.silverUsd,
      estimatedTax: annualTax.totalTax,
      magi: annualTax.magi,
      spend: spendAfterCut,
      accountsStart,
      accountsEnd: snapshotAccounts(accounts, accountLabels, marketReturnById),
      events: ledger.events,
    });
  }

  const endingBalance = years[years.length - 1]?.portfolioTotal ?? 0;

  return {
    years,
    endingBalance,
    depletedAge,
    primaryRmdAge,
    spouseRmdAge,
    maxAge,
    warnings,
    failed: failed || depletedAge != null,
    totalRothConverted,
    totalExpenseCuts,
    totalCryptoHarvested,
    ledgers,
    simulationMeta: simulationMetaFromRequest(simRequest, simSeed),
  };
}

export function money(n: number, digits = 0): string {
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
