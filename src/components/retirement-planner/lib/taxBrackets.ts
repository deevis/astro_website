/**
 * Simplified federal tax bracket ceilings and IRMAA MAGI cliffs for planning.
 * 2026 baseline; future years use the plan inflation assumption.
 * IRS: https://www.irs.gov/irb/2025-45_IRB
 * CMS: https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles
 */

export interface BracketTop {
  rate: number;
  /** Top of ordinary-income taxable bracket (USD, current dollars) */
  taxableIncomeTop: number;
}

/** 2026 ordinary income bracket tops (taxable income). */
export const FEDERAL_BRACKET_TOPS_SINGLE: BracketTop[] = [
  { rate: 0.1, taxableIncomeTop: 12_400 },
  { rate: 0.12, taxableIncomeTop: 50_400 },
  { rate: 0.22, taxableIncomeTop: 105_700 },
  { rate: 0.24, taxableIncomeTop: 201_775 },
  { rate: 0.32, taxableIncomeTop: 256_225 },
  { rate: 0.35, taxableIncomeTop: 640_600 },
  { rate: 0.37, taxableIncomeTop: Infinity },
];

export const FEDERAL_BRACKET_TOPS_MFJ: BracketTop[] = [
  { rate: 0.1, taxableIncomeTop: 24_800 },
  { rate: 0.12, taxableIncomeTop: 100_800 },
  { rate: 0.22, taxableIncomeTop: 211_400 },
  { rate: 0.24, taxableIncomeTop: 403_550 },
  { rate: 0.32, taxableIncomeTop: 512_450 },
  { rate: 0.35, taxableIncomeTop: 768_700 },
  { rate: 0.37, taxableIncomeTop: Infinity },
];

/**
 * First IRMAA MAGI cliff (Part B/D surcharge begins above this).
 * 2026 thresholds used as planning defaults.
 */
export const IRMAA_FIRST_CLIFF_SINGLE = 109_000;
export const IRMAA_FIRST_CLIFF_MFJ = 218_000;

export function bracketCeiling(
  filing: 'single' | 'married',
  targetRate: number
): number {
  const table = filing === 'married' ? FEDERAL_BRACKET_TOPS_MFJ : FEDERAL_BRACKET_TOPS_SINGLE;
  const row = table.find((b) => b.rate >= targetRate) ?? table[table.length - 1];
  return row.taxableIncomeTop;
}

export function irmaaFirstCliff(filing: 'single' | 'married'): number {
  return filing === 'married' ? IRMAA_FIRST_CLIFF_MFJ : IRMAA_FIRST_CLIFF_SINGLE;
}

/**
 * How much room remains under the conversion target given current MAGI proxy.
 * Returns 0 if already at/over the ceiling.
 */
export function conversionRoom(params: {
  filing: 'single' | 'married';
  currentMagi: number;
  targetBracketRate: number;
  irmaaAware: boolean;
  inflationFactor: number;
}): number {
  const bracketTop =
    bracketCeiling(params.filing, params.targetBracketRate) * params.inflationFactor;
  let ceiling = bracketTop;
  if (params.irmaaAware) {
    const cliff = irmaaFirstCliff(params.filing) * params.inflationFactor;
    // Stay a small buffer under the cliff
    ceiling = Math.min(ceiling, cliff - 1_000);
  }
  return Math.max(0, ceiling - params.currentMagi);
}

export const STANDARD_DEDUCTION_SINGLE = 16_100;
export const STANDARD_DEDUCTION_MFJ = 32_200;
export const LTCG_TOPS_SINGLE = [49_450, 545_500] as const;
export const LTCG_TOPS_MFJ = [98_900, 613_700] as const;
export const IRMAA_TIERS_SINGLE = [109_000, 137_000, 171_000, 205_000, 500_000] as const;
export const IRMAA_TIERS_MFJ = [218_000, 274_000, 342_000, 410_000, 750_000] as const;
