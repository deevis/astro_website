/**
 * Bitcoin fair-value pricing models from the site article
 * (Stock-to-Flow, S2FX, Power-Law, Rainbow, Metcalfe, Halving Cycles).
 * Formulas ported from public/js/bitcoin-pricing-models.js — date-driven, no CSV required.
 */

export type BitcoinPricingModelId =
  | 'expectedReturn'
  | 'amalgam'
  | 's2f'
  | 's2fx'
  | 'powerLaw'
  | 'rainbow'
  | 'metcalfe'
  | 'halving';

export const BITCOIN_PRICING_MODEL_LABELS: Record<BitcoinPricingModelId, string> = {
  expectedReturn: 'Fixed return (assumptions)',
  amalgam: 'Weighted mix of models',
  s2f: 'Stock-to-Flow (PlanB)',
  s2fx: 'Stock-to-Flow Cross-Asset (S2FX)',
  powerLaw: 'Power-Law Corridor',
  rainbow: 'Log-Regression Rainbow',
  metcalfe: "Metcalfe's Law",
  halving: 'Halving Cycles',
};

export type BitcoinAmalgamModelId = Exclude<BitcoinPricingModelId, 'expectedReturn' | 'amalgam'>;

/** Models that can participate in the amalgam mix. */
export const AMALGAM_MODEL_IDS: BitcoinAmalgamModelId[] = [
  's2f',
  's2fx',
  'powerLaw',
  'rainbow',
  'metcalfe',
  'halving',
];

export interface BitcoinAmalgamComponent {
  id: BitcoinAmalgamModelId;
  enabled: boolean;
  /** Relative weight vs other enabled models. 2 and 1 → 2/3 and 1/3 of the mix. */
  weight: number;
}

export function createDefaultBitcoinAmalgamMix(): BitcoinAmalgamComponent[] {
  return AMALGAM_MODEL_IDS.map((id) => ({ id, enabled: true, weight: 1 }));
}

const AMALGAM_ID_SET = new Set<string>(AMALGAM_MODEL_IDS);

/**
 * Normalize a saved mix. Missing mix → all six at equal weight.
 * A partial list treats omitted models as off. If nothing valid remains, fall back to the default.
 */
export function resolveAmalgamMix(
  mix?: readonly BitcoinAmalgamComponent[] | null
): BitcoinAmalgamComponent[] {
  if (!mix || mix.length === 0) return createDefaultBitcoinAmalgamMix();
  const byId = new Map<BitcoinAmalgamModelId, BitcoinAmalgamComponent>();
  for (const row of mix) {
    if (!row || !AMALGAM_ID_SET.has(row.id)) continue;
    const weight = Number(row.weight);
    byId.set(row.id, {
      id: row.id,
      enabled: row.enabled !== false,
      weight: Number.isFinite(weight) ? Math.min(99, Math.max(0, weight)) : 1,
    });
  }
  const resolved = AMALGAM_MODEL_IDS.map(
    (id) => byId.get(id) ?? { id, enabled: false, weight: 1 }
  );
  if (!resolved.some((row) => row.enabled && row.weight > 0)) return createDefaultBitcoinAmalgamMix();
  return resolved;
}

export function amalgamMixId(mix?: readonly BitcoinAmalgamComponent[] | null): string {
  const active = resolveAmalgamMix(mix).filter((row) => row.enabled && row.weight > 0);
  const equalAll =
    active.length === AMALGAM_MODEL_IDS.length && active.every((row) => row.weight === 1);
  if (equalAll) return 'amalgam';
  return `amalgam:${active.map((row) => `${row.id}*${row.weight}`).join('+')}`;
}

const BLOCKS_PER_DAY = 144;
const DAYS_PER_YEAR = 365.25;
const BLOCKS_PER_HALVING = 210000;
const GENESIS_DATE = new Date('2009-01-03T12:00:00Z');

function daysSinceGenesis(date: Date): number {
  return (date.getTime() - GENESIS_DATE.getTime()) / (1000 * 60 * 60 * 24);
}

function calculateSupply(date: Date): number {
  const days = daysSinceGenesis(date);
  const blockHeight = Math.floor(days * BLOCKS_PER_DAY);

  let totalSupply = 0;
  let currentReward = 50;
  let blocksProcessed = 0;

  while (blocksProcessed < blockHeight) {
    const blocksToNextHalving = BLOCKS_PER_HALVING - (blocksProcessed % BLOCKS_PER_HALVING);
    const blocksToProcess = Math.min(blocksToNextHalving, blockHeight - blocksProcessed);
    totalSupply += blocksToProcess * currentReward;
    blocksProcessed += blocksToProcess;
    if (blocksProcessed % BLOCKS_PER_HALVING === 0) {
      currentReward /= 2;
    }
  }
  return totalSupply;
}

function calculateAnnualFlow(date: Date): number {
  const days = daysSinceGenesis(date);
  const blockHeight = Math.floor(days * BLOCKS_PER_DAY);
  const halvingsPassed = Math.floor(blockHeight / BLOCKS_PER_HALVING);
  const currentReward = 50 / Math.pow(2, halvingsPassed);
  return currentReward * BLOCKS_PER_DAY * DAYS_PER_YEAR;
}

function stockToFlowPrice(date: Date): number {
  const supply = calculateSupply(date);
  const annualFlow = calculateAnnualFlow(date);
  const stockToFlow = supply / annualFlow;
  return Math.exp(3.3 * Math.log(stockToFlow) - 1.7);
}

function s2fxPrice(date: Date): number {
  const supply = calculateSupply(date);
  const annualFlow = calculateAnnualFlow(date);
  const stockToFlow = supply / annualFlow;
  return Math.exp(4.5 * Math.log(stockToFlow) - 12.6);
}

function powerLawCenter(date: Date): number {
  const days = daysSinceGenesis(date);
  const logDays = Math.log10(Math.max(days, 1));
  const logPrice = 5.84 * logDays - 17.01;
  return Math.pow(10, logPrice);
}

function rainbowCenter(date: Date): number {
  const days = daysSinceGenesis(date);
  const logDays = Math.log10(Math.max(days, 1));
  const logPrice = 5.4 * logDays - 15.5;
  return Math.pow(10, logPrice);
}

function metcalfePrice(date: Date): number {
  const days = daysSinceGenesis(date);
  const estimatedUsers = Math.pow(days / 365, 2.1) * 100_000;
  const metcalfeCoeff = 2e-10;
  return metcalfeCoeff * estimatedUsers * estimatedUsers;
}

function halvingCyclePrice(date: Date): number {
  const days = daysSinceGenesis(date);
  const blockHeight = Math.floor(days * BLOCKS_PER_DAY);
  const currentCycle = Math.floor(blockHeight / BLOCKS_PER_HALVING);
  const cycleProgress = (blockHeight % BLOCKS_PER_HALVING) / BLOCKS_PER_HALVING;

  let cycleFactor = 1;
  if (cycleProgress < 0.7) {
    cycleFactor = 1 + cycleProgress * 0.5;
  } else if (cycleProgress < 0.85) {
    cycleFactor = 1.35 + (cycleProgress - 0.7) * 20;
  } else {
    cycleFactor = 4.35 - (cycleProgress - 0.85) * 25;
  }

  const basePriceGrowth = Math.pow(10, currentCycle * 1.5);
  return basePriceGrowth * cycleFactor;
}

const MODEL_PRICE_FN: Record<BitcoinAmalgamModelId, (date: Date) => number> = {
  s2f: stockToFlowPrice,
  s2fx: s2fxPrice,
  powerLaw: powerLawCenter,
  rainbow: rainbowCenter,
  metcalfe: metcalfePrice,
  halving: halvingCyclePrice,
};

/** Mid-year UTC anchor for calendar-year projections. */
export function calendarYearToModelDate(calendarYear: number): Date {
  return new Date(Date.UTC(calendarYear, 6, 15));
}

export function bitcoinModelPriceUsd(
  model: BitcoinPricingModelId,
  date: Date,
  mix?: readonly BitcoinAmalgamComponent[] | null
): number | null {
  if (model === 'expectedReturn' || !Number.isFinite(date.getTime())) return null;

  if (model === 'amalgam') {
    let weighted = 0;
    let weightSum = 0;
    for (const row of resolveAmalgamMix(mix)) {
      if (!row.enabled || row.weight <= 0) continue;
      const price = MODEL_PRICE_FN[row.id](date);
      if (!Number.isFinite(price) || price <= 0) continue;
      weighted += price * row.weight;
      weightSum += row.weight;
    }
    if (weightSum <= 0) return null;
    return weighted / weightSum;
  }

  const priceFn = MODEL_PRICE_FN[model];
  if (!priceFn) return null;
  const price = priceFn(date);
  return Number.isFinite(price) && price > 0 ? price : null;
}

/**
 * Year-over-year return implied by a pricing model between two calendar years.
 */
export function bitcoinModelAnnualReturn(
  model: BitcoinPricingModelId,
  calendarYear: number,
  mix?: readonly BitcoinAmalgamComponent[] | null
): number | null {
  if (model === 'expectedReturn') return null;
  const priceNow = bitcoinModelPriceUsd(model, calendarYearToModelDate(calendarYear), mix);
  const priceNext = bitcoinModelPriceUsd(model, calendarYearToModelDate(calendarYear + 1), mix);
  if (priceNow == null || priceNext == null || priceNow <= 0) return null;
  return priceNext / priceNow - 1;
}

export function usesBitcoinPricingModel(model: BitcoinPricingModelId | undefined): boolean {
  return model != null && model !== 'expectedReturn';
}

/**
 * Scale a model curve so it passes through anchorSpot on anchorDate.
 * Keeps the user's entered spot at plan start while following model shape forward.
 */
export function scaledBitcoinModelPriceUsd(
  model: BitcoinPricingModelId,
  date: Date,
  anchorSpot: number,
  anchorDate: Date = new Date(),
  mix?: readonly BitcoinAmalgamComponent[] | null
): number | null {
  if (!Number.isFinite(anchorSpot) || anchorSpot <= 0) return null;
  const priceAtAnchor = bitcoinModelPriceUsd(model, anchorDate, mix);
  const priceAtDate = bitcoinModelPriceUsd(model, date, mix);
  if (priceAtAnchor == null || priceAtDate == null || priceAtAnchor <= 0) return null;
  return anchorSpot * (priceAtDate / priceAtAnchor);
}

/** Growth for a full projection year, with the same plan-start anchor for every account. */
export function bitcoinProjectionReturn(
  model: BitcoinPricingModelId,
  startYear: number,
  yearIndex: number,
  mix?: readonly BitcoinAmalgamComponent[] | null
): number | null {
  return bitcoinModelAnnualReturn(model, startYear + yearIndex, mix);
}
