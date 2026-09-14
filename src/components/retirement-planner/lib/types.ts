/** Retirement Planner plan schema (v1 + Phase 2 hooks). */

import { computePersonBenefits } from './socialSecurity';
import {
  createDefaultBitcoinAmalgamMix,
  resolveAmalgamMix,
  type BitcoinAmalgamComponent,
  type BitcoinPricingModelId,
} from './bitcoinPricingModels';
export type { BitcoinAmalgamComponent, BitcoinPricingModelId } from './bitcoinPricingModels';

export type FilingStatus = 'single' | 'married';
export type AccountOwner = 'primary' | 'spouse' | 'joint';
export type AccountType =
  | 'traditionalIra'
  | 'rothIra'
  | 'traditional401k'
  | 'roth401k'
  | 'brokerage'
  | 'crypto'
  | 'bitcoin'
  | 'gold'
  | 'silver'
  | 'cd'
  | 'bond'
  | 'hysa';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  traditionalIra: 'Traditional IRA',
  rothIra: 'Roth IRA',
  traditional401k: 'Traditional 401(k)',
  roth401k: 'Roth 401(k)',
  brokerage: 'Brokerage',
  crypto: 'Crypto wallet',
  bitcoin: 'Bitcoin',
  gold: 'Gold',
  silver: 'Silver',
  cd: 'Certificate of Deposit',
  bond: 'Bonds',
  hysa: 'High-yield savings',
};

/** Default expected annual returns when creating a new account of each type. */
export const ACCOUNT_TYPE_DEFAULT_RETURNS: Record<AccountType, number> = {
  traditionalIra: 0.06,
  rothIra: 0.06,
  traditional401k: 0.06,
  roth401k: 0.06,
  brokerage: 0.07,
  crypto: 0.08,
  // Long-term store-of-value assumption; distinct from altcoin speculation
  bitcoin: 0.12,
  // Long-run real metals return ≈ inflation + small premium; nominal ~4–5%
  gold: 0.045,
  silver: 0.05,
  cd: 0.042,
  bond: 0.035,
  hysa: 0.04,
};

/** Unit label for spot-priced assets (display units; gold amounts are entered in grams). */
export const ACCOUNT_UNIT_LABELS: Partial<Record<AccountType, string>> = {
  bitcoin: 'BTC',
  gold: 'g',
  silver: 'oz t',
};

/** Exact troy ounce in grams — gold spot remains $/oz t under the hood. */
export const GRAMS_PER_TROY_OUNCE = 31.1034768;

export function troyOzToGrams(oz: number): number {
  return oz * GRAMS_PER_TROY_OUNCE;
}

export function gramsToTroyOz(grams: number): number {
  return grams / GRAMS_PER_TROY_OUNCE;
}

/**
 * Parse a gold amount string. Defaults to grams (`67`, `67g`, `67 grams`).
 * Also accepts troy ounces with an oz suffix (`2.15oz`, `2 oz t`).
 */
export function parseGoldAmountToTroyOz(raw: string): number | null {
  const cleaned = raw.trim().toLowerCase().replace(/,/g, '');
  if (!cleaned) return null;
  const m = cleaned.match(/^([\d.]+)\s*(g|grams?|oz\.?\s*t?|ozt|troy)?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0) return null;
  const unit = (m[2] ?? 'g').replace(/\s+/g, '').replace(/\./g, '');
  if (unit.startsWith('oz') || unit === 'ozt' || unit === 'troy') {
    return n;
  }
  return gramsToTroyOz(n);
}

export function formatGoldGrams(troyOz: number): string {
  const g = troyOzToGrams(troyOz);
  if (g >= 100) return `${g.toFixed(0)}g`;
  if (g >= 10) return `${g.toFixed(1)}g`;
  return `${g.toFixed(2)}g`;
}

export type RothConversionPolicy =
  | 'none'
  | 'fillBracket'
  | 'irmaaAware'
  | 'customSchedule';

export type RmdPolicy = 'minimumOnly' | 'spendFromRmdFirst' | 'convertBeforeRmd';

export interface PersonProfile {
  name: string;
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  /** Medicare Part B typically starts at 65 */
  medicareStartAge: number;
  /**
   * Calendar month of birth (1–12). Salary and payroll contributions are
   * prorated from today through this month in the retirement year. Missing
   * values use July (mid-year).
   */
  birthMonth?: number | null;
}

export interface Account {
  id: string;
  type: AccountType;
  label: string;
  owner: AccountOwner;
  balance: number;
  annualContribution: number;
  /** Expected annual return, e.g. 0.07 */
  expectedReturn: number;
  /** Optional allocation weight 0–1 within portfolio */
  allocationWeight?: number;
  /**
   * Roth contribution basis — penalty-free withdrawals before 59½.
   * Used by RAMP accessible-assets check; estimated from contributions if unset.
   */
  contributionBasis?: number;
  /**
   * For Bitcoin (and optionally other unit-priced assets): quantity held.
   * When set with spotPriceUsd, balance should equal units × price.
   */
  assetUnits?: number;
  /** Current spot price in USD (e.g. BTC-USD). Used for harvest sale reporting. */
  spotPriceUsd?: number;
  /**
   * Total cost basis in USD for taxable alt sleeves (bitcoin, crypto, gold, silver)
   * and taxable brokerage. Used for capital-gains estimates on sales.
   */
  costBasisUsd?: number;
  /**
   * Optional tax lots for taxable accounts (FIFO/proportional until lot UI exists).
   * When empty, engine uses aggregate costBasisUsd proportionally.
   */
  taxLots?: TaxLot[];
  /**
   * Employer 401(k) match per year (today's $), added while the owner is working.
   * Typically set on traditional401k; grows with the account balance.
   */
  employerMatchAnnual?: number;
}

/** Single purchase lot for cost-basis tracking. */
export interface TaxLot {
  id: string;
  purchaseDate: string;
  quantity: number;
  costBasisUsd: number;
}

export interface IncomeStream {
  id: string;
  label: string;
  annualAmount: number;
  startAge: number;
  endAge: number | null;
  owner: AccountOwner;
  taxable: boolean;
  /**
   * Primary earned income that stops at the owner's Household retirement age.
   * When only one income stream exists, this is assumed true even if unset.
   */
  endsAtRetirement?: boolean;
}

export interface ExpenseItem {
  id: string;
  label: string;
  annualAmount: number;
  /** If set, amount used from this age onward (e.g. retirement step-down) */
  retirementAnnualAmount?: number;
  startAge: number;
  endAge: number | null;
  category?: ExpenseCategory;
}

export type ExpenseCategory = 'general' | 'travel' | 'healthInsurance';

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  general: 'General',
  travel: 'Travel',
  healthInsurance: 'Health insurance',
};

export function inferExpenseCategory(label: string): ExpenseCategory {
  const t = (label ?? '').toLowerCase();
  if (/travel|vacation|trip|holiday/.test(t)) return 'travel';
  if (/insur|health|medicare|medical|premium/.test(t)) return 'healthInsurance';
  return 'general';
}

export function expenseCategoryOf(item: Pick<ExpenseItem, 'label' | 'category'>): ExpenseCategory {
  return item.category ?? inferExpenseCategory(item.label);
}

export interface EarningsYear {
  year: number;
  amount: number;
}

export interface SocialSecurityPerson {
  owner: 'primary' | 'spouse';
  earningsHistory: EarningsYear[];
  claimAge: number;
  futureWorkYears: number;
  futureAnnualEarnings: number;
  /** Cached monthly benefit at claim age; computed by SS engine later */
  estimatedMonthlyBenefit?: number;
}

/** Phase 2+ tax / healthcare / spending strategy. */
export interface TaxStrategy {
  stateOfResidence: string;
  rothConversionPolicy: RothConversionPolicy;
  /** e.g. 0.22 = fill up to top of 22% bracket */
  targetFederalBracketCeiling: number;
  irmaaAvoidance: boolean;
  rmdPolicy: RmdPolicy;
  customConversionByYear: { year: number; amount: number }[];
  /**
   * In negative portfolio-return years, cut plan expenses by this fraction
   * (e.g. 0.10 = discretionary 10% cut) and favor cash/savings withdrawals.
   */
  downYearExpenseCut: number;
  /** Prefer spending cash/HYSA/CDs before risk assets in down years */
  favorCashInDownYears: boolean;
  /**
   * In retired years before Social Security starts, convert Traditional → Roth
   * up to the bracket / IRMAA ceiling (when policy ≠ none).
   */
  convertInSsGapYears: boolean;
  /**
   * Monthly premium for private/ACA coverage in the retirement → Medicare gap
   * (today's dollars). Applied annually until medicareStartAge.
   */
  monthlyInsuranceUntilMedicare: number;
  /**
   * Standard Medicare Part B monthly premium per person (today's dollars).
   * Charged from the later of that person's retirement and Medicare start age.
   */
  monthlyMedicarePartB: number;
  /**
   * In the retirement → Social Security gap, sell up to a capped fraction of
   * Bitcoin/crypto/gold/silver into HYSA when that sleeve is at or near its ATH
   * and the liquid buffer is below athHarvestBufferYears.
   * Edited from the Bitcoin section; still respected as an ATH kill-switch.
   */
  athHarvestEnabled: boolean;
  /** Maximum drawdown from the observed peak eligible for harvesting (0 = exact ATH). */
  athHarvestNearAthFraction: number;
  /** Whether harvesting stops when primary Social Security starts. */
  athHarvestWindow: 'ssGap' | 'retirement';
  /** Max fraction of an alt sleeve sold per ATH year (e.g. 0.16 = 16%) */
  athHarvestMaxSleeveFraction: number;
  /** Liquid buffer trigger and fill target for ATH harvest (HYSA + CD + bonds) */
  athHarvestBufferYears: number;
  /** @deprecated Replaced by athHarvestEnabled — kept for saved-plan migration */
  harvestCryptoToCash?: boolean;
  /** @deprecated Ignored by engine */
  cryptoHarvestGainFraction?: number;
  /** @deprecated Ignored by engine */
  cryptoHarvestPrincipalCap?: number;
  /** Target years of spending held in HYSA + CD + bonds (RAMP portfolio check) */
  liquidBufferTargetYears: number;
}

export type BitcoinSellPolicy = 'athHarvest' | 'allocationTrim' | 'athAndTrim';
export type BitcoinTrimWindow = 'anytime' | 'retirement' | 'ssGap';

export const BITCOIN_SELL_POLICY_LABELS: Record<BitcoinSellPolicy, string> = {
  athHarvest: 'Near-ATH harvest — wait for a peak, then refill cash',
  allocationTrim: 'Balanced trim — clip overweight BTC/crypto and refill thin HYSA',
  athAndTrim: 'Both — harvest peaks and trim along the way',
};

export const BITCOIN_TRIM_WINDOW_LABELS: Record<BitcoinTrimWindow, string> = {
  anytime: 'Any year (including while working)',
  retirement: 'Throughout retirement',
  ssGap: 'Retirement until Social Security',
};

/**
 * First-class Bitcoin / crypto sell playbook.
 * Price-path assumptions stay on PlanAssumptions; this object is the behavior.
 */
export interface BitcoinStrategy {
  sellPolicy: BitcoinSellPolicy;
  /**
   * Max BTC (+ crypto if included) as a fraction of remaining non-alt financial
   * assets. 0.35 = alts may be 35% of everything that is not BTC/crypto.
   */
  maxAltShareOfNonAlt: number;
  /** Max fraction of each BTC/crypto sleeve sold in one trim year. */
  trimMaxSleeveFraction: number;
  /** Trim into HYSA when HYSA runway is below this many years of spending. */
  trimWhenCashBelowYears: number;
  trimWindow: BitcoinTrimWindow;
  includeCryptoInTrim: boolean;
}

export function createDefaultBitcoinStrategy(): BitcoinStrategy {
  return {
    sellPolicy: 'athHarvest',
    maxAltShareOfNonAlt: 0.35,
    trimMaxSleeveFraction: 0.08,
    trimWhenCashBelowYears: 2,
    trimWindow: 'anytime',
    includeCryptoInTrim: true,
  };
}

export function allocationTrimEnabled(plan: Pick<RetirementPlan, 'bitcoinStrategy'>): boolean {
  const policy = plan.bitcoinStrategy?.sellPolicy ?? 'athHarvest';
  return policy === 'allocationTrim' || policy === 'athAndTrim';
}

export function athHarvestPolicyEnabled(plan: Pick<RetirementPlan, 'bitcoinStrategy' | 'taxStrategy'>): boolean {
  const policy = plan.bitcoinStrategy?.sellPolicy ?? 'athHarvest';
  if (policy === 'allocationTrim') return false;
  return plan.taxStrategy.athHarvestEnabled !== false;
}

function pctLabel(fraction: number, digits = 0): string {
  return `${(Math.min(1, Math.max(0, fraction)) * 100).toFixed(digits)}%`;
}

/** Human-readable Bitcoin sell playbook for confirm dialogs and summaries. */
export function describeBitcoinSellPlaybook(
  plan: Pick<RetirementPlan, 'bitcoinStrategy' | 'taxStrategy' | 'accounts'>
): { title: string; details: string[] } {
  const strategy = plan.bitcoinStrategy ?? createDefaultBitcoinStrategy();
  const policy = strategy.sellPolicy;
  const title = BITCOIN_SELL_POLICY_LABELS[policy];
  const details: string[] = [];
  const btcUsd = plan.accounts
    .filter((a) => a.type === 'bitcoin')
    .reduce((sum, a) => sum + Math.max(0, a.balance), 0);

  if (btcUsd <= 0) {
    details.push('No Bitcoin holdings in this plan — the playbook will not sell anything.');
    return { title, details };
  }

  if (athHarvestPolicyEnabled(plan)) {
    const sleeve = pctLabel(plan.taxStrategy.athHarvestMaxSleeveFraction ?? 0.16);
    const near = pctLabel(plan.taxStrategy.athHarvestNearAthFraction ?? 0.05, 1);
    const buffer = plan.taxStrategy.athHarvestBufferYears ?? 4;
    const window =
      plan.taxStrategy.athHarvestWindow === 'retirement'
        ? BITCOIN_TRIM_WINDOW_LABELS.retirement
        : BITCOIN_TRIM_WINDOW_LABELS.ssGap;
    details.push(
      `Near-ATH harvest: sell up to ${sleeve} of a sleeve when within ${near} of a recorded high if liquid reserves are below ${buffer} years. Window: ${window}.`
    );
  } else if (policy !== 'allocationTrim') {
    details.push('Near-ATH harvest is turned off.');
  }

  if (allocationTrimEnabled(plan)) {
    const share = pctLabel(strategy.maxAltShareOfNonAlt);
    const clip = pctLabel(strategy.trimMaxSleeveFraction);
    const cashYears = strategy.trimWhenCashBelowYears;
    const window = BITCOIN_TRIM_WINDOW_LABELS[strategy.trimWindow] ?? strategy.trimWindow;
    const sleeve = strategy.includeCryptoInTrim ? 'Bitcoin/crypto' : 'Bitcoin';
    details.push(
      `Balanced trim: clip ${sleeve} when it exceeds ${share} of other financial assets, or HYSA is below ${cashYears} years of spending. Max ${clip} of a sleeve per year. Window: ${window}.`
    );
  }

  return { title, details };
}

export type MarketRegime = 'recession' | 'normal' | 'boom';

/**
 * Market-cycle (regime) settings used by the Monte Carlo engine.
 * Each simulated year is classified as recession / normal / boom, shifting
 * that year's expected returns. Defaults reflect post-war US history.
 */
export interface MarketCycleAssumptions {
  /** Chance any given year is a recession/down year (S&P 1986–2025: ~22%) */
  recessionProbability: number;
  /**
   * Chance a down year is followed by another down year
   * (S&P 1986–2025: 2 of 9 ≈ 22%; only 2000–02 ran longer than 1 year)
   */
  recessionPersistence: number;
  /**
   * Hard cap on consecutive recession years. Historical S&P max in our
   * sample is 3 (2000–2002). Prevents inventing 4–5 year bear streaks.
   */
  maxRecessionStreak: number;
  /** Average extra equity loss in a recession year (e.g. -0.22 → mean 7% becomes -15%) */
  recessionEquityShift: number;
  /** Chance any given year is a boom (S&P ≥20%: ~32% of years 1986–2025) */
  boomProbability: number;
  /**
   * Hard cap on consecutive boom years (S&P ≥20%). Historical max in our
   * sample is 4 (1995–1998). Prevents inventing endless bull streaks.
   */
  maxBoomStreak: number;
  /** Average extra equity gain in a boom year (e.g. +0.14 → mean 7% becomes 21%) */
  boomEquityShift: number;
  /** How strongly crypto amplifies the market cycle (2 = twice the equity shift) */
  cryptoRegimeMultiplier: number;
  /**
   * When true, equity-like accounts draw calendar-year returns from the
   * historical S&P pool for the current regime (down / mid / boom) instead
   * of a Gaussian — sequences match observed history much more closely.
   */
  useHistoricalEquityBootstrap: boolean;
}

export interface PlanAssumptions {
  inflationRate: number;
  equityReturn: number;
  equityVolatility: number;
  bondReturn: number;
  bondVolatility: number;
  /** Cash / HYSA / CD long-run yield */
  cashReturn: number;
  /** Rate-risk volatility for cash-like accounts (very low) */
  cashVolatility: number;
  cryptoReturn: number;
  cryptoVolatility: number;
  /** Bitcoin long-term expected return (store-of-value path) */
  bitcoinReturn: number;
  /** Bitcoin annual volatility — lower than altcoins, still meaningful */
  bitcoinVolatility: number;
  /** Gold long-term expected nominal return */
  goldReturn: number;
  goldVolatility: number;
  /** Silver long-term expected nominal return */
  silverReturn: number;
  silverVolatility: number;
  /** Fixed withdrawal rate if not using spend-from-plan */
  withdrawalRate: number;
  useSpendFromPlan: boolean;
  monteCarloRuns: number;
  /** Success threshold 0–1, e.g. 0.8 = 80% */
  successThreshold: number;
  marketCycle: MarketCycleAssumptions;
  /**
   * How projected Bitcoin spot price evolves. Models match the article's six frameworks;
   * amalgam is a weighted mix (see bitcoinAmalgamMix). expectedReturn uses bitcoinReturn /
   * bitcoinVolatility only.
   */
  bitcoinPricingModel?: BitcoinPricingModelId;
  /**
   * Which models participate in amalgam and at what relative weights.
   * Default is all six at weight 1. Ignored unless bitcoinPricingModel is amalgam.
   */
  bitcoinAmalgamMix?: BitcoinAmalgamComponent[];
  /**
   * Known Bitcoin market all-time high (USD). ATH harvest high-water marks start at
   * max(plan-start spot, this value) so prices below the real peak are not treated as ATH.
   */
  bitcoinHistoricalAthUsd?: number;
}

/** Default market ATH for harvest seeding (~Nov 2024 cycle peak). */
export const DEFAULT_BITCOIN_HISTORICAL_ATH_USD = 126_000;

/**
 * Ongoing payroll / automatic savings (legacy).
 * Migrated onto account.annualContribution / employerMatchAnnual — no longer edited in UI.
 */
export interface PayrollSavings {
  /** @deprecated Use HYSA account annualContribution */
  monthlyHysaDeposit: number;
  /** @deprecated Use traditional401k account annualContribution */
  traditional401kEmployeeAnnual: number;
  /** @deprecated Use traditional401k account employerMatchAnnual */
  traditional401kMatchPercent: number;
  traditional401kMatchUpToOfPay: number;
  /** @deprecated Use roth401k account annualContribution */
  roth401kEmployeeAnnual: number;
}

/** Preference weights for the retirement-date optimizer (0–100). */
export interface OptimizerPreferences {
  retireSooner: number;
  higherSpending: number;
  certainty: number;
  legacy: number;
}

export type RealEstateKind = 'primaryResidence' | 'rental';

/**
 * Primary home or investment/rental property.
 * Carrying costs and rental NOI feed cashflow; equity is illiquid unless opted in.
 */
export interface RealEstateProperty {
  id: string;
  kind: RealEstateKind;
  label: string;
  /** Estimated market value (today's $) */
  estimatedValue: number;
  /** Annual mortgage principal & interest (today's $). 0 if paid off / no loan. */
  mortgagePaymentAnnual: number;
  /** Remaining loan balance — for net equity */
  mortgageBalance: number;
  /**
   * Primary age when mortgage payments stop.
   * null = keep paying while mortgagePaymentAnnual > 0 (through life expectancy).
   */
  mortgagePayoffAge: number | null;
  /** Annual property tax (today's $) */
  propertyTaxAnnual: number;
  /** Annual homeowners / landlord insurance (today's $) */
  insuranceAnnual: number;
  /**
   * Rental only: net cash flow after operating expenses (today's $).
   * Can be negative if property runs at a loss.
   */
  netIncomeAnnual: number;
  /**
   * If true, (estimatedValue − mortgageBalance) counts toward RAMP accessible assets.
   * Default false — home equity is not penalty-free spendable cash.
   */
  countsTowardAccessibleAssets: boolean;
}

export type OtherAssetCategory =
  | 'vehicle'
  | 'boat'
  | 'motorcycle'
  | 'art'
  | 'collectible'
  | 'other';

export const OTHER_ASSET_CATEGORY_LABELS: Record<OtherAssetCategory, string> = {
  vehicle: 'Vehicle',
  boat: 'Boat',
  motorcycle: 'Motorcycle',
  art: 'Art',
  collectible: 'Collectible',
  other: 'Other',
};

/**
 * Personal / lifestyle assets for Net Worth (cars, boats, art).
 * Not investable portfolio — illiquid unless opted into RAMP accessible.
 */
export interface OtherPersonalAsset {
  id: string;
  category: OtherAssetCategory;
  label: string;
  estimatedValue: number;
  /** Insurance, storage, maintenance, etc. (today's $/yr) */
  annualCost: number;
  countsTowardAccessibleAssets: boolean;
}

export interface RetirementPlan {
  schemaVersion: 1 | 2;
  name: string;
  updatedAt: string;
  filingStatus: FilingStatus;
  primary: PersonProfile;
  spouse: PersonProfile | null;
  accounts: Account[];
  income: IncomeStream[];
  expenses: ExpenseItem[];
  socialSecurity: SocialSecurityPerson[];
  assumptions: PlanAssumptions;
  taxStrategy: TaxStrategy;
  bitcoinStrategy: BitcoinStrategy;
  payrollSavings: PayrollSavings;
  optimizerPreferences: OptimizerPreferences;
  realEstate: RealEstateProperty[];
  otherAssets: OtherPersonalAsset[];
}

export type PlannerSectionId =
  | 'household'
  | 'assets'
  | 'realEstate'
  | 'otherAssets'
  | 'bitcoin'
  | 'incomeExpenses'
  | 'socialSecurity'
  | 'assumptions'
  | 'dateOptimizer'
  | 'ramp'
  | 'projection'
  | 'monteCarlo'
  | 'taxStrategy';

export const PLANNER_SECTIONS: { id: PlannerSectionId; label: string; comingSoon?: boolean }[] = [
  { id: 'household', label: 'Household' },
  { id: 'assets', label: 'Assets' },
  { id: 'bitcoin', label: 'Bitcoin' },
  { id: 'realEstate', label: 'Real Estate' },
  { id: 'otherAssets', label: 'Other Assets' },
  { id: 'incomeExpenses', label: 'Income & Expenses' },
  { id: 'socialSecurity', label: 'Social Security' },
  { id: 'assumptions', label: 'Assumptions' },
  { id: 'dateOptimizer', label: 'Date Optimizer' },
  { id: 'ramp', label: 'RAMP Checklist' },
  { id: 'projection', label: 'Projection' },
  { id: 'monteCarlo', label: 'Monte Carlo' },
  { id: 'taxStrategy', label: 'Tax Strategy' },
];

/** 2026 standard Medicare Part B premium (CMS). Inflated with plan inflation in the engine. */
export const MEDICARE_PART_B_MONTHLY_2026 = 202.9;

export function createDefaultPerson(name = 'You'): PersonProfile {
  return {
    name,
    currentAge: 45,
    retirementAge: 67,
    lifeExpectancy: 90,
    medicareStartAge: 65,
    birthMonth: DEFAULT_BIRTH_MONTH,
  };
}

export function createDefaultTaxStrategy(): TaxStrategy {
  return {
    stateOfResidence: '',
    // Optimal default: convert in the retirement / pre-SS gap, IRMAA-aware
    rothConversionPolicy: 'irmaaAware',
    targetFederalBracketCeiling: 0.22,
    irmaaAvoidance: true,
    rmdPolicy: 'minimumOnly',
    customConversionByYear: [],
    downYearExpenseCut: 0.1,
    favorCashInDownYears: true,
    convertInSsGapYears: true,
    monthlyInsuranceUntilMedicare: 750,
    monthlyMedicarePartB: MEDICARE_PART_B_MONTHLY_2026,
    athHarvestEnabled: true,
    athHarvestNearAthFraction: 0.05,
    athHarvestWindow: 'ssGap',
    athHarvestMaxSleeveFraction: 0.16,
    athHarvestBufferYears: 4,
    liquidBufferTargetYears: 2,
  };
}

export function createDefaultMarketCycle(): MarketCycleAssumptions {
  return {
    // Calibrated to S&P 500 calendar years 1986–2025 (historical_yoy_returns.csv)
    recessionProbability: 0.22,
    // Only 2 of 9 down years were followed by another down year
    recessionPersistence: 0.22,
    // Longest observed streak: 2000–2002
    maxRecessionStreak: 3,
    // Down-year mean ≈ −13%; with 7% base → shift ≈ −20%
    recessionEquityShift: -0.2,
    // ~32% of years returned ≥ 20%
    boomProbability: 0.32,
    // Longest ≥20% streak: 1995–1998
    maxBoomStreak: 4,
    // Boom-year mean ≈ +27%; with 7% base → shift ≈ +20%
    boomEquityShift: 0.2,
    cryptoRegimeMultiplier: 1.25,
    useHistoricalEquityBootstrap: true,
  };
}

export function createDefaultAssumptions(): PlanAssumptions {
  return {
    inflationRate: 0.025,
    equityReturn: 0.07,
    // Historical S&P sample std ≈ 16%
    equityVolatility: 0.16,
    bondReturn: 0.035,
    bondVolatility: 0.05,
    // Near current HYSA / short CD yields; rates mean-revert slowly
    cashReturn: 0.04,
    cashVolatility: 0.005,
    cryptoReturn: 0.08,
    cryptoVolatility: 0.45,
    // Bitcoin as long-horizon collateral: solid expected return, less altcoin-like vol
    bitcoinReturn: 0.12,
    bitcoinVolatility: 0.35,
    goldReturn: 0.045,
    goldVolatility: 0.16,
    silverReturn: 0.05,
    silverVolatility: 0.28,
    withdrawalRate: 0.04,
    useSpendFromPlan: true,
    monteCarloRuns: 1000,
    successThreshold: 0.8,
    marketCycle: createDefaultMarketCycle(),
    bitcoinPricingModel: 'amalgam',
    bitcoinAmalgamMix: createDefaultBitcoinAmalgamMix(),
    bitcoinHistoricalAthUsd: DEFAULT_BITCOIN_HISTORICAL_ATH_USD,
  };
}

export function createDefaultPayrollSavings(): PayrollSavings {
  return {
    monthlyHysaDeposit: 0,
    traditional401kEmployeeAnnual: 0,
    traditional401kMatchPercent: 0.5,
    traditional401kMatchUpToOfPay: 0.06,
    roth401kEmployeeAnnual: 0,
  };
}

export function createDefaultOptimizerPreferences(): OptimizerPreferences {
  return {
    retireSooner: 60,
    higherSpending: 50,
    certainty: 70,
    legacy: 40,
  };
}

export function createEmptyRealEstateProperty(
  kind: RealEstateKind = 'primaryResidence'
): RealEstateProperty {
  return {
    id: newId(kind === 'primaryResidence' ? 'home' : 'rental'),
    kind,
    label: kind === 'primaryResidence' ? 'Primary residence' : 'Rental property',
    estimatedValue: 0,
    mortgagePaymentAnnual: 0,
    mortgageBalance: 0,
    mortgagePayoffAge: null,
    propertyTaxAnnual: 0,
    insuranceAnnual: 0,
    netIncomeAnnual: 0,
    countsTowardAccessibleAssets: false,
  };
}

export function createEmptyOtherPersonalAsset(
  category: OtherAssetCategory = 'vehicle'
): OtherPersonalAsset {
  return {
    id: newId('other'),
    category,
    label: OTHER_ASSET_CATEGORY_LABELS[category],
    estimatedValue: 0,
    annualCost: 0,
    countsTowardAccessibleAssets: false,
  };
}

export function otherAssetsTotalValue(assets: OtherPersonalAsset[]): number {
  return assets.reduce((s, a) => s + Math.max(0, a.estimatedValue), 0);
}

export function otherAssetsAnnualCost(assets: OtherPersonalAsset[]): number {
  return assets.reduce((s, a) => s + Math.max(0, a.annualCost), 0);
}

/**
 * Annual spending need at a primary age, in today’s dollars (no inflation).
 * Matches the cashflow engine’s year-0 expense rules, including real-estate
 * carrying costs, other-asset upkeep, and the Medicare-gap insurance premium.
 */
export type SpendLineKind = 'expense' | 'housing' | 'other' | 'insurance' | 'withdrawalRate';

export interface SpendLine {
  label: string;
  amount: number;
  kind: SpendLineKind;
  /** Premium is not charged at this age but will be later. */
  upcoming?: boolean;
}

export function formatSpendBreakdown(lines: SpendLine[], total: number): string {
  const money = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const rows = lines
    .filter((l) => l.amount > 0)
    .map((l) => `${l.upcoming ? 'Later · ' : ''}${l.label}: ${money(l.amount)}`);
  rows.push(`Total now: ${money(total)}`);
  return rows.join('\n');
}

export function personAgeAtPrimaryAge(
  plan: Pick<RetirementPlan, 'primary' | 'spouse'>,
  owner: 'primary' | 'spouse',
  primaryAge: number
): number {
  if (owner === 'spouse' && plan.spouse) {
    return primaryAge + (plan.spouse.currentAge - plan.primary.currentAge);
  }
  return primaryAge;
}

function personMedicarePartBStart(person: { retirementAge: number; medicareStartAge: number }): number {
  return Math.max(person.retirementAge, person.medicareStartAge);
}

/**
 * Out-of-pocket health premiums: household Medicare-gap coverage while retired
 * and before Medicare, then standard Part B per person after eligibility.
 */
export function healthPremiumsAtAge(
  plan: Pick<RetirementPlan, 'primary' | 'spouse' | 'filingStatus' | 'taxStrategy'>,
  primaryAge: number,
  options?: { monthlyInsuranceUntilMedicare?: number; monthlyMedicarePartB?: number }
): { due: SpendLine[]; upcoming: SpendLine[]; dueTotal: number } {
  const gapMonthly =
    options?.monthlyInsuranceUntilMedicare ?? plan.taxStrategy.monthlyInsuranceUntilMedicare ?? 0;
  const partBMonthly =
    options?.monthlyMedicarePartB ??
    plan.taxStrategy.monthlyMedicarePartB ??
    MEDICARE_PART_B_MONTHLY_2026;
  const due: SpendLine[] = [];
  const upcoming: SpendLine[] = [];

  const gapStart = plan.primary.retirementAge;
  const gapEnd = plan.primary.medicareStartAge;
  if (gapMonthly > 0 && gapStart < gapEnd && gapStart < plan.primary.lifeExpectancy) {
    const amount = gapMonthly * 12;
    const label = `Medicare-gap insurance (ages ${Math.round(gapStart)}–${Math.round(gapEnd - 1)})`;
    const line: SpendLine = { label, amount, kind: 'insurance' };
    if (primaryAge >= gapStart && primaryAge < gapEnd) due.push(line);
    else if (primaryAge < gapStart) upcoming.push({ ...line, upcoming: true });
  }

  const addPartB = (
    person: { name: string; retirementAge: number; medicareStartAge: number; lifeExpectancy: number },
    personAge: number,
    who: string
  ) => {
    if (partBMonthly <= 0) return;
    const start = personMedicarePartBStart(person);
    if (start >= person.lifeExpectancy) return;
    const amount = partBMonthly * 12;
    const label = `Medicare Part B · ${who} (from age ${Math.round(start)})`;
    const line: SpendLine = { label, amount, kind: 'insurance' };
    if (personAge >= start) due.push(line);
    else upcoming.push({ ...line, upcoming: true });
  };

  addPartB(plan.primary, primaryAge, plan.primary.name || 'You');
  if (plan.filingStatus === 'married' && plan.spouse) {
    addPartB(
      plan.spouse,
      personAgeAtPrimaryAge(plan, 'spouse', primaryAge),
      plan.spouse.name || 'Spouse'
    );
  }

  return { due, upcoming, dueTotal: due.reduce((s, l) => s + l.amount, 0) };
}

export function nominalAnnualSpendAtAge(
  plan: Pick<
    RetirementPlan,
    'assumptions' | 'expenses' | 'accounts' | 'primary' | 'realEstate' | 'otherAssets' | 'taxStrategy'
  >,
  age: number,
  options?: { monthlyInsuranceUntilMedicare?: number; monthlyMedicarePartB?: number }
): {
  total: number;
  usingWithdrawalRate: boolean;
  insurance: number;
  housing: number;
  lines: SpendLine[];
} {
  const lines: SpendLine[] = [];
  let usingWithdrawalRate = false;
  const retired = age >= plan.primary.retirementAge;
  if (!plan.assumptions.useSpendFromPlan || plan.expenses.length === 0) {
    if (retired) {
      const start = plan.accounts.reduce((s, a) => s + a.balance, 0);
      const amount = start * plan.assumptions.withdrawalRate;
      if (amount > 0) {
        lines.push({
          label: `${(plan.assumptions.withdrawalRate * 100).toFixed(1)}% withdrawal rate`,
          amount,
          kind: 'withdrawalRate',
        });
      }
      usingWithdrawalRate = true;
    }
  } else {
    for (const item of plan.expenses) {
      if (age < item.startAge) continue;
      if (item.endAge != null && age > item.endAge) continue;
      const base =
        retired && item.retirementAnnualAmount != null
          ? item.retirementAnnualAmount
          : item.annualAmount;
      const amount = Math.max(0, base);
      if (amount > 0) {
        lines.push({ label: item.label || 'Expense', amount, kind: 'expense' });
      }
    }
  }

  let housing = 0;
  for (const prop of plan.realEstate ?? []) {
    const amount = realEstateCarryingCostAtAge(prop, age);
    if (amount > 0) {
      housing += amount;
      lines.push({
        label: `Housing · ${prop.label || 'Property'}`,
        amount,
        kind: 'housing',
      });
    }
  }
  for (const asset of plan.otherAssets ?? []) {
    const amount = Math.max(0, asset.annualCost);
    if (amount > 0) {
      lines.push({ label: asset.label || 'Other asset', amount, kind: 'other' });
    }
  }

  const premiums = healthPremiumsAtAge(plan, age, options);
  lines.push(...premiums.due, ...premiums.upcoming);
  const insurance = premiums.dueTotal;
  const total = lines.filter((l) => !l.upcoming).reduce((s, l) => s + l.amount, 0);
  return { total, usingWithdrawalRate, insurance, housing, lines };
}

/** Annual carrying cost (mortgage if still due + tax + insurance) at a given primary age. */
export function realEstateCarryingCostAtAge(
  property: RealEstateProperty,
  age: number
): number {
  let cost = Math.max(0, property.propertyTaxAnnual) + Math.max(0, property.insuranceAnnual);
  const payment = Math.max(0, property.mortgagePaymentAnnual);
  if (payment > 0) {
    const payoff = property.mortgagePayoffAge;
    if (payoff == null || age < payoff) cost += payment;
  }
  return cost;
}

/** Net rental income at age (0 for primary residence). */
export function realEstateNetIncomeAtAge(
  property: RealEstateProperty,
  _age: number
): number {
  if (property.kind !== 'rental') return 0;
  return property.netIncomeAnnual;
}

export function realEstateNetEquity(property: RealEstateProperty): number {
  return Math.max(0, property.estimatedValue - Math.max(0, property.mortgageBalance));
}

/**
 * One-time: copy legacy payrollSavings onto existing accounts, then clear payroll.
 * Does not create empty $0 shells — only updates accounts the user already has.
 * Also removes leftover empty HYSA/401k shells (no balance, contrib, or match).
 */
export function migratePayrollSavingsToAccounts(plan: RetirementPlan): RetirementPlan {
  const ps = plan.payrollSavings ?? createDefaultPayrollSavings();
  const hasLegacy =
    ps.monthlyHysaDeposit > 0 ||
    ps.traditional401kEmployeeAnnual > 0 ||
    ps.roth401kEmployeeAnnual > 0 ||
    (ps.traditional401kMatchPercent > 0 && ps.traditional401kEmployeeAnnual > 0);

  let accounts = plan.accounts.map((a) => ({ ...a }));

  if (hasLegacy) {
    const patch = (
      type: AccountType,
      annualContribution: number,
      employerMatchAnnual?: number
    ) => {
      const i = accounts.findIndex((a) => a.type === type && a.owner === 'primary');
      if (i < 0) return;
      const cur = accounts[i]!;
      accounts[i] = {
        ...cur,
        annualContribution:
          annualContribution > 0 ? annualContribution : cur.annualContribution,
        ...(employerMatchAnnual != null && employerMatchAnnual > 0
          ? {
              employerMatchAnnual: Math.max(
                cur.employerMatchAnnual ?? 0,
                employerMatchAnnual
              ),
            }
          : {}),
      };
    };

    // Approximate match $ from legacy % × employee deferral (user can edit exact $ later)
    const approxMatch =
      Math.max(0, ps.traditional401kEmployeeAnnual) *
      Math.max(0, ps.traditional401kMatchPercent);

    patch('hysa', Math.max(0, ps.monthlyHysaDeposit) * 12);
    patch('traditional401k', Math.max(0, ps.traditional401kEmployeeAnnual), approxMatch);
    patch('roth401k', Math.max(0, ps.roth401kEmployeeAnnual));
  }

  // Drop empty HYSA/401k shells (no balance, contrib, or match) — leftovers from payroll sync
  accounts = accounts.filter((a) => {
    if (a.type !== 'hysa' && a.type !== 'traditional401k' && a.type !== 'roth401k') return true;
    if (a.balance > 0) return true;
    if ((a.annualContribution ?? 0) > 0) return true;
    if ((a.employerMatchAnnual ?? 0) > 0) return true;
    return false;
  });

  return {
    ...plan,
    accounts,
    payrollSavings: createDefaultPayrollSavings(),
  };
}

/** @deprecated No longer creates shells — use migratePayrollSavingsToAccounts via mergePlanDefaults. */
export function syncPayrollAccounts(plan: RetirementPlan): RetirementPlan {
  return migratePayrollSavingsToAccounts(plan);
}

/** Mid-year stand-in when a birth month is not stored. */
export const DEFAULT_BIRTH_MONTH = 7;

export const BIRTH_MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function resolvedBirthMonth(month?: number | null): number {
  if (typeof month === 'number' && Number.isFinite(month)) {
    const rounded = Math.round(month);
    if (rounded >= 1 && rounded <= 12) return rounded;
  }
  return DEFAULT_BIRTH_MONTH;
}

/** Fraction of the calendar year still ahead of `asOf` (1 on Jan 1, ~0.25 in early October). */
export function remainingCalendarYearFraction(asOf: Date = new Date()): number {
  const year = asOf.getFullYear();
  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  if (end <= start) return 1;
  return Math.min(1, Math.max(0, (end - asOf.getTime()) / (end - start)));
}

/** First of the birth month in the year this person reaches `retirementAge`. */
export function retirementDate(
  currentAge: number,
  retirementAge: number,
  birthMonth: number | null | undefined,
  asOf: Date
): Date {
  const month = resolvedBirthMonth(birthMonth);
  const age = Math.max(0, Math.floor(currentAge));
  const hadBirthday = asOf.getMonth() + 1 >= month;
  const birthYear = asOf.getFullYear() - age - (hadBirthday ? 0 : 1);
  return new Date(birthYear + Math.round(retirementAge), month - 1, 1);
}

/** Share of `calendarYear` still worked (from today, until the retirement birthday). */
export function workFractionInCalendarYear(
  currentAge: number,
  retirementAge: number,
  birthMonth: number | null | undefined,
  asOf: Date,
  calendarYear: number
): number {
  if (calendarYear < asOf.getFullYear()) return 0;
  const yearStart = new Date(calendarYear, 0, 1);
  const yearEnd = new Date(calendarYear + 1, 0, 1);
  const yearMs = yearEnd.getTime() - yearStart.getTime();
  if (yearMs <= 0) return 0;
  const retireAt = retirementDate(currentAge, retirementAge, birthMonth, asOf);
  const workStart = calendarYear === asOf.getFullYear() ? asOf : yearStart;
  const workEnd = retireAt.getTime() < yearEnd.getTime() ? retireAt : yearEnd;
  return Math.max(0, Math.min(1, (workEnd.getTime() - workStart.getTime()) / yearMs));
}

/** Remaining years of work from `asOf` through the retirement birthday. */
export function remainingWorkYears(
  currentAge: number,
  retirementAge: number,
  birthMonth?: number | null,
  asOf: Date = new Date()
): number {
  const retireAt = retirementDate(currentAge, retirementAge, birthMonth, asOf);
  if (retireAt.getTime() <= asOf.getTime()) return 0;
  const startY = asOf.getFullYear();
  const endY = retireAt.getFullYear();
  let sum = 0;
  for (let y = startY; y <= endY; y++) {
    sum += workFractionInCalendarYear(currentAge, retirementAge, birthMonth, asOf, y);
  }
  return sum;
}

/** Whole years of future earnings for SSA (integer-age rule, floored at 0). */
export function computeFutureWorkYears(currentAge: number, retirementAge: number): number {
  return Math.max(0, Math.floor(retirementAge - currentAge));
}

/** True when this stream is treated as primary pay that stops at retirement. */
export function incomeEndsAtRetirement(
  stream: IncomeStream,
  all: IncomeStream[]
): boolean {
  return stream.endsAtRetirement ?? all.length <= 1;
}

/** Preserve independent salary/pension choices; infer only for legacy records. */
export function ensurePrimaryIncomeFlags(income: IncomeStream[]): IncomeStream[] {
  return income.map((stream, index) => ({ ...stream, endsAtRetirement: stream.endsAtRetirement ?? index === 0 }));
}

/**
 * Keep Social Security future-work years and primary-income end ages aligned
 * with Household retirement ages.
 */
export function syncRetirementDerivedFields(plan: RetirementPlan): RetirementPlan {
  const socialSecurity = plan.socialSecurity.map((s) => {
    if (s.owner === 'primary') {
      return {
        ...s,
        futureWorkYears: computeFutureWorkYears(
          plan.primary.currentAge,
          plan.primary.retirementAge
        ),
      };
    }
    if (s.owner === 'spouse' && plan.spouse) {
      return {
        ...s,
        futureWorkYears: computeFutureWorkYears(
          plan.spouse.currentAge,
          plan.spouse.retirementAge
        ),
      };
    }
    return s;
  });

  for (const ss of socialSecurity) {
    const person = ss.owner === 'spouse' ? plan.spouse : plan.primary;
    if (person && ss.estimatedMonthlyBenefit != null && ss.earningsHistory.length > 0 && Number.isFinite(person.currentAge)) {
      const benefit = computePersonBenefits({ currentAge: person.currentAge, earningsHistory: ss.earningsHistory, claimAge: ss.claimAge, futureWorkYears: ss.futureWorkYears, futureAnnualEarnings: ss.futureAnnualEarnings });
      ss.estimatedMonthlyBenefit = benefit?.claimAgeMonthly;
    }
  }
  const ensured = ensurePrimaryIncomeFlags(plan.income);
  const income = ensured.map((stream) => {
    if (!incomeEndsAtRetirement(stream, ensured)) return stream;
    const retirementAge =
      stream.owner === 'spouse' && plan.spouse
        ? plan.spouse.retirementAge
        : plan.primary.retirementAge;
    return {
      ...stream,
      endsAtRetirement: true,
      endAge: retirementAge,
    };
  });

  return { ...plan, socialSecurity, income };
}

/** Migrate v1 plans to v2 (tax lots array, schema bump). */
export function migratePlanToV2(plan: RetirementPlan): RetirementPlan {
  const accounts = (plan.accounts ?? []).map((a) => {
    const taxLots =
      a.taxLots ??
      (a.costBasisUsd != null && a.costBasisUsd > 0
        ? [
            {
              id: newId('lot'),
              purchaseDate: new Date().toISOString().slice(0, 10),
              quantity: a.assetUnits ?? a.balance,
              costBasisUsd: a.costBasisUsd,
            },
          ]
        : undefined);
    return { ...a, taxLots };
  });
  return { ...plan, schemaVersion: 2, accounts };
}

/** Fill in any fields added after a plan was saved (schema-tolerant merge). */
export function mergePlanDefaults(plan: RetirementPlan): RetirementPlan {
  let merged = { ...plan };
  if (merged.schemaVersion === 1 || merged.schemaVersion == null) {
    merged = migratePlanToV2({ ...merged, schemaVersion: 1 });
  }
  const incomingCycle = plan.assumptions?.marketCycle ?? {};
  // Plans saved before historical calibration lack streak caps — refresh
  // the cycle defaults so persistence/probabilities match the S&P sample.
  const needsCycleRecalibration =
    !('maxRecessionStreak' in incomingCycle) || !('maxBoomStreak' in incomingCycle);

  const defaults = createEmptyPlan();

  return syncRetirementDerivedFields(
    migratePayrollSavingsToAccounts({
      ...defaults,
      ...merged,
      schemaVersion: 2,
      assumptions: {
        ...defaults.assumptions,
        ...merged.assumptions,
        bitcoinPricingModel:
          merged.assumptions?.bitcoinPricingModel ?? defaults.assumptions.bitcoinPricingModel,
        bitcoinAmalgamMix: resolveAmalgamMix(merged.assumptions?.bitcoinAmalgamMix),
        bitcoinHistoricalAthUsd:
          merged.assumptions?.bitcoinHistoricalAthUsd ??
          defaults.assumptions.bitcoinHistoricalAthUsd,
        marketCycle: needsCycleRecalibration
          ? { ...defaults.assumptions.marketCycle }
          : {
              ...defaults.assumptions.marketCycle,
              ...(incomingCycle as Partial<typeof defaults.assumptions.marketCycle>),
            },
      },
      taxStrategy: {
        ...defaults.taxStrategy,
        ...(merged.taxStrategy ?? {}),
        athHarvestEnabled:
          merged.taxStrategy?.athHarvestEnabled ??
          merged.taxStrategy?.harvestCryptoToCash ??
          defaults.taxStrategy.athHarvestEnabled,
        athHarvestMaxSleeveFraction:
          merged.taxStrategy?.athHarvestMaxSleeveFraction ??
          defaults.taxStrategy.athHarvestMaxSleeveFraction,
        athHarvestBufferYears:
          merged.taxStrategy?.athHarvestBufferYears ??
          defaults.taxStrategy.athHarvestBufferYears,
      },
      bitcoinStrategy: {
        ...defaults.bitcoinStrategy,
        ...(merged.bitcoinStrategy ?? {}),
      },
      payrollSavings: {
        ...defaults.payrollSavings,
        ...(merged.payrollSavings ?? {}),
      },
      optimizerPreferences: {
        ...defaults.optimizerPreferences,
        ...(merged.optimizerPreferences ?? {}),
      },
      primary: {
        ...defaults.primary,
        ...merged.primary,
        birthMonth: resolvedBirthMonth(merged.primary?.birthMonth ?? defaults.primary.birthMonth),
      },
      spouse: merged.spouse
        ? {
            ...createDefaultPerson(merged.spouse.name || 'Spouse'),
            ...merged.spouse,
            birthMonth: resolvedBirthMonth(merged.spouse.birthMonth),
          }
        : null,
      realEstate: merged.realEstate ?? defaults.realEstate,
      otherAssets: merged.otherAssets ?? defaults.otherAssets,
      expenses: (merged.expenses ?? defaults.expenses).map((e) => ({
        ...e,
        category: e.category ?? inferExpenseCategory(e.label ?? ''),
      })),
    })
  );
}

export function createEmptyPlan(): RetirementPlan {
  const primary = createDefaultPerson('You');
  return {
    schemaVersion: 2,
    name: 'My Retirement Plan',
    updatedAt: new Date().toISOString(),
    filingStatus: 'single',
    primary,
    spouse: null,
    accounts: [],
    income: [],
    expenses: [],
    socialSecurity: [
      {
        owner: 'primary',
        earningsHistory: [],
        claimAge: 67,
        futureWorkYears: computeFutureWorkYears(primary.currentAge, primary.retirementAge),
        futureAnnualEarnings: 0,
      },
    ],
    assumptions: createDefaultAssumptions(),
    taxStrategy: createDefaultTaxStrategy(),
    bitcoinStrategy: createDefaultBitcoinStrategy(),
    payrollSavings: createDefaultPayrollSavings(),
    optimizerPreferences: createDefaultOptimizerPreferences(),
    realEstate: [],
    otherAssets: [],
  };
}

export function newId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
