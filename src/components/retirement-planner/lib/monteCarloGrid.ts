import { liquidateBitcoinToCash } from './bitcoinLiquidation';
import {
  newId,
  nominalAnnualSpendAtAge,
  realEstateCarryingCostAtAge,
  syncRetirementDerivedFields,
  type RetirementPlan,
  type SpendLine,
} from './types';

export const GRID_SIZE = 6;
export const GRID_CELL_COUNT = GRID_SIZE * GRID_SIZE;
export const SPEND_STEP_USD = 5_000;
/** 3 steps down, current, 2 steps up. */
export const SPEND_DELTAS_USD = [-15_000, -10_000, -5_000, 0, 5_000, 10_000] as const;
export const SELL_BROKERAGE_PERCENTS = [0, 25, 50, 75, 100] as const;

export function bitcoinSellSplitLabel(brokeragePercent: number): string {
  const brokerage = Math.min(100, Math.max(0, Math.round(brokeragePercent)));
  const hysa = 100 - brokerage;
  return `Sell BTC - ${hysa}% HYSA ${brokerage}% Brokerage`;
}

export type GridAxisId = 'bitcoin' | 'retirementAge' | 'spend' | 'ssClaimAge';
/** @deprecated Use GridAxisId. Kept as an alias for a locked leftover axis. */
export type GridInelasticAxis = GridAxisId;

export const GRID_AXIS_IDS: GridAxisId[] = ['bitcoin', 'retirementAge', 'spend', 'ssClaimAge'];

export const GRID_AXIS_LABELS: Record<GridAxisId, { long: string; short: string }> = {
  bitcoin: { long: 'Bitcoin today', short: 'Bitcoin' },
  retirementAge: { long: 'Retirement age', short: 'Age' },
  spend: { long: 'Starting spend', short: 'Spend' },
  ssClaimAge: { long: 'SS claim age', short: 'SS' },
};

export function lockedGridAxes(rowAxis: GridAxisId, colAxis: GridAxisId): GridAxisId[] {
  return GRID_AXIS_IDS.filter((id) => id !== rowAxis && id !== colAxis);
}

export function lockedGridAxis(rowAxis: GridAxisId, colAxis: GridAxisId): GridAxisId {
  return lockedGridAxes(rowAxis, colAxis)[0] ?? 'bitcoin';
}

export function primarySsClaimAge(plan: Pick<RetirementPlan, 'socialSecurity'>): number {
  const age = plan.socialSecurity.find((s) => s.owner === 'primary')?.claimAge ?? 67;
  return Math.min(70, Math.max(62, Math.round(age)));
}

export type BitcoinGridChoiceId =
  | 'hold'
  | 'sell-0'
  | 'sell-25'
  | 'sell-50'
  | 'sell-75'
  | 'sell-100';

export interface BitcoinGridChoice {
  id: BitcoinGridChoiceId;
  label: string;
  shortLabel: string;
  /** null = keep Bitcoin; otherwise percent of net proceeds into brokerage */
  brokeragePercent: number | null;
}

export const BITCOIN_GRID_CHOICES: BitcoinGridChoice[] = [
  { id: 'hold', label: 'Keep Bitcoin (don’t sell today)', shortLabel: 'Keep BTC', brokeragePercent: null },
  ...SELL_BROKERAGE_PERCENTS.map((brokeragePercent) => {
    const label = bitcoinSellSplitLabel(brokeragePercent);
    return {
      id: `sell-${brokeragePercent}` as BitcoinGridChoiceId,
      label,
      shortLabel: label,
      brokeragePercent,
    };
  }),
];

export interface GridAxisValue {
  id: string;
  label: string;
  shortLabel: string;
  spendLines?: SpendLine[];
  spendTotal?: number;
  /** Household retirement age or current starting spend. */
  isDefault?: boolean;
}

export interface GridScenario {
  bitcoinId: BitcoinGridChoiceId;
  retirementAge: number;
  spendTarget: number;
  /** Primary Social Security claim age. Spouse claim age is left as-is. */
  ssClaimAge?: number;
}

export interface GridLockedAxis {
  axis: GridAxisId;
  label: string;
  spendLines?: SpendLine[];
  spendTotal?: number;
}

export interface GridSpec {
  inelastic: GridAxisId;
  locked: GridLockedAxis[];
  rowAxis: GridAxisId;
  colAxis: GridAxisId;
  rows: GridAxisValue[];
  cols: GridAxisValue[];
  cells: { row: number; col: number; scenario: GridScenario }[];
}

export function bitcoinGridChoice(id: BitcoinGridChoiceId): BitcoinGridChoice {
  return BITCOIN_GRID_CHOICES.find((c) => c.id === id) ?? BITCOIN_GRID_CHOICES[0]!;
}

/**
 * Six retirement ages around the Household target: two years before and three
 * after when that is possible. If the person is already at/past the target,
 * unused “before” slots become extra years after (4 after if only one year
 * before is possible, 5 after if none are).
 */
export function retirementAgeGridValues(targetAge: number, currentAge: number): number[] {
  const floor = Math.max(0, Math.ceil(currentAge));
  const target = Math.round(targetAge);
  if (target < floor) {
    return Array.from({ length: GRID_SIZE }, (_, i) => floor + i);
  }
  const before: number[] = [];
  for (let yearsBefore = 2; yearsBefore >= 1; yearsBefore--) {
    const age = target - yearsBefore;
    if (age >= floor) before.push(age);
  }
  const afterCount = GRID_SIZE - before.length - 1;
  const ages = [...before, target];
  for (let i = 1; i <= afterCount; i++) ages.push(target + i);
  return ages;
}

export function spendGridTargets(baseSpend: number): number[] {
  const base = Math.max(0, baseSpend);
  return SPEND_DELTAS_USD.map((delta) => Math.max(0, base + delta));
}

/**
 * Six claim ages in [62, 70] around the plan target: two years before and three
 * after when that fits. Unused slots on one side become extra years on the other.
 */
export function ssClaimAgeGridValues(targetAge: number): number[] {
  const floor = 62;
  const ceil = 70;
  const target = Math.min(ceil, Math.max(floor, Math.round(targetAge)));
  const before: number[] = [];
  for (let yearsBefore = 2; yearsBefore >= 1; yearsBefore--) {
    const age = target - yearsBefore;
    if (age >= floor) before.push(age);
  }
  const after: number[] = [];
  const afterWanted = GRID_SIZE - before.length - 1;
  for (let i = 1; i <= afterWanted; i++) {
    const age = target + i;
    if (age > ceil) break;
    after.push(age);
  }
  while (before.length + 1 + after.length < GRID_SIZE) {
    const nextBefore = (before[0] ?? target) - 1;
    if (nextBefore < floor) break;
    before.unshift(nextBefore);
  }
  while (before.length + 1 + after.length < GRID_SIZE) {
    const nextAfter = (after[after.length - 1] ?? target) + 1;
    if (nextAfter > ceil) break;
    after.push(nextAfter);
  }
  return [...before, target, ...after];
}

export function gridAxisPair(inelastic: GridAxisId): {
  rowAxis: GridAxisId;
  colAxis: GridAxisId;
} {
  if (inelastic === 'bitcoin' || inelastic === 'ssClaimAge') {
    return { rowAxis: 'retirementAge', colAxis: 'spend' };
  }
  if (inelastic === 'retirementAge') return { rowAxis: 'bitcoin', colAxis: 'spend' };
  return { rowAxis: 'bitcoin', colAxis: 'retirementAge' };
}

export function resolveGridAxes(options: {
  inelastic?: GridAxisId;
  rowAxis?: GridAxisId;
  colAxis?: GridAxisId;
}): { rowAxis: GridAxisId; colAxis: GridAxisId; inelastic: GridAxisId } {
  const rowAxis = options.rowAxis;
  const colAxis = options.colAxis;
  if (rowAxis && colAxis && rowAxis !== colAxis) {
    return { rowAxis, colAxis, inelastic: lockedGridAxis(rowAxis, colAxis) };
  }
  const inelastic = options.inelastic ?? 'bitcoin';
  const pair = gridAxisPair(inelastic);
  return { ...pair, inelastic };
}

function moneyLabel(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function valuesForAxis(
  axis: GridAxisId,
  plan: RetirementPlan,
  lockedBitcoinId: BitcoinGridChoiceId
): GridAxisValue[] {
  if (axis === 'bitcoin') {
    return BITCOIN_GRID_CHOICES.map((c) => ({
      id: c.id,
      label: c.label,
      shortLabel: c.shortLabel,
    }));
  }
  if (axis === 'retirementAge') {
    const target = Math.round(plan.primary.retirementAge);
    return retirementAgeGridValues(plan.primary.retirementAge, plan.primary.currentAge).map((age) => ({
      id: `age-${age}`,
      label: `Retire at ${age}`,
      shortLabel: `Age ${age}`,
      isDefault: age === target,
    }));
  }
  if (axis === 'ssClaimAge') {
    const target = primarySsClaimAge(plan);
    return ssClaimAgeGridValues(target).map((age) => ({
      id: `ss-${age}`,
      label: `Claim SS at ${age}`,
      shortLabel: `SS ${age}`,
      isDefault: age === target,
    }));
  }
  const base = nominalAnnualSpendAtAge(plan, plan.primary.currentAge).total;
  return spendGridTargets(base).map((amount, i) => {
    const delta = SPEND_DELTAS_USD[i]!;
    const deltaLabel =
      delta === 0 ? 'current' : delta > 0 ? `+${moneyLabel(delta)}` : moneyLabel(delta);
    const scaled = applySpendTarget(plan, amount);
    const detail = nominalAnnualSpendAtAge(scaled, plan.primary.currentAge);
    return {
      id: `spend:${delta}`,
      label: `${moneyLabel(amount)}/yr (${deltaLabel})`,
      shortLabel: moneyLabel(amount),
      spendLines: detail.lines,
      spendTotal: detail.total,
      isDefault: delta === 0,
    };
  });
}

function scenarioFromAxes(
  rowAxis: GridAxisId,
  colAxis: GridAxisId,
  row: GridAxisValue,
  col: GridAxisValue,
  plan: RetirementPlan,
  lockedBitcoinId: BitcoinGridChoiceId
): GridScenario {
  const pick = (axis: GridAxisId, value: GridAxisValue | null): Partial<GridScenario> => {
    if (axis === 'bitcoin') {
      return { bitcoinId: (value?.id ?? lockedBitcoinId) as BitcoinGridChoiceId };
    }
    if (axis === 'retirementAge') {
      const age = value ? Number(value.id.replace('age-', '')) : plan.primary.retirementAge;
      return { retirementAge: age };
    }
    if (axis === 'ssClaimAge') {
      const age = value ? Number(value.id.replace('ss-', '')) : primarySsClaimAge(plan);
      return { ssClaimAge: age };
    }
    const base = nominalAnnualSpendAtAge(plan, plan.primary.currentAge).total;
    if (!value) return { spendTarget: base };
    const delta = Number(value.id.replace('spend:', ''));
    return { spendTarget: Math.max(0, base + (Number.isFinite(delta) ? delta : 0)) };
  };
  return {
    bitcoinId: lockedBitcoinId,
    retirementAge: plan.primary.retirementAge,
    spendTarget: nominalAnnualSpendAtAge(plan, plan.primary.currentAge).total,
    ssClaimAge: primarySsClaimAge(plan),
    ...pick(rowAxis, row),
    ...pick(colAxis, col),
  };
}

function lockedAxisDetails(
  axis: GridAxisId,
  plan: RetirementPlan,
  lockedBitcoinId: BitcoinGridChoiceId
): GridLockedAxis {
  if (axis === 'bitcoin') {
    return { axis, label: bitcoinGridChoice(lockedBitcoinId).label };
  }
  if (axis === 'retirementAge') {
    return { axis, label: `Retire at ${plan.primary.retirementAge}` };
  }
  if (axis === 'ssClaimAge') {
    return { axis, label: `Claim SS at ${primarySsClaimAge(plan)}` };
  }
  const spendDetail = nominalAnnualSpendAtAge(plan, plan.primary.currentAge);
  return {
    axis,
    label: `${moneyLabel(spendDetail.total)}/yr`,
    spendLines: spendDetail.lines,
    spendTotal: spendDetail.total,
  };
}

export function buildMonteCarloGrid(
  plan: RetirementPlan,
  options: {
    inelastic?: GridAxisId;
    rowAxis?: GridAxisId;
    colAxis?: GridAxisId;
    lockedBitcoinId?: BitcoinGridChoiceId;
  }
): GridSpec {
  const lockedBitcoinId = options.lockedBitcoinId ?? 'hold';
  const { rowAxis, colAxis, inelastic } = resolveGridAxes(options);
  const rows = valuesForAxis(rowAxis, plan, lockedBitcoinId);
  const cols = valuesForAxis(colAxis, plan, lockedBitcoinId);
  const cells: GridSpec['cells'] = [];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols.length; c++) {
      cells.push({
        row: r,
        col: c,
        scenario: scenarioFromAxes(rowAxis, colAxis, rows[r]!, cols[c]!, plan, lockedBitcoinId),
      });
    }
  }

  const locked = lockedGridAxes(rowAxis, colAxis).map((axis) =>
    lockedAxisDetails(axis, plan, lockedBitcoinId)
  );

  return {
    inelastic,
    locked,
    rowAxis,
    colAxis,
    rows,
    cols,
    cells,
  };
}

export function applySpendTarget(plan: RetirementPlan, targetTotal: number): RetirementPlan {
  const next = structuredClone(plan);
  const age = next.primary.currentAge;
  const current = nominalAnnualSpendAtAge(next, age);
  const insurance = current.insurance;
  const desiredEx = Math.max(0, targetTotal - insurance);
  const currentEx = Math.max(0, current.total - insurance);
  if (Math.abs(currentEx - desiredEx) < 0.5) return next;

  const carrying =
    (next.realEstate ?? []).reduce((s, p) => s + realEstateCarryingCostAtAge(p, age), 0) +
    (next.otherAssets ?? []).reduce((s, a) => s + Math.max(0, a.annualCost), 0);
  const desiredLifestyle = Math.max(0, desiredEx - carrying);
  const retired = age >= next.primary.retirementAge;

  if (next.assumptions.useSpendFromPlan && next.expenses.length > 0) {
    const activeIdx: number[] = [];
    let activeSum = 0;
    next.expenses.forEach((item, i) => {
      if (age < item.startAge) return;
      if (item.endAge != null && age > item.endAge) return;
      const base =
        retired && item.retirementAnnualAmount != null
          ? item.retirementAnnualAmount
          : item.annualAmount;
      activeIdx.push(i);
      activeSum += Math.max(0, base);
    });
    if (activeSum > 0) {
      const scale = desiredLifestyle / activeSum;
      for (const i of activeIdx) {
        const item = next.expenses[i]!;
        item.annualAmount = Math.max(0, item.annualAmount * scale);
        if (item.retirementAnnualAmount != null) {
          item.retirementAnnualAmount = Math.max(0, item.retirementAnnualAmount * scale);
        }
      }
    } else if (desiredLifestyle > 0) {
      next.expenses.push({
        id: newId('grid-spend'),
        label: 'Lifestyle spending',
        annualAmount: desiredLifestyle,
        startAge: 18,
        endAge: null,
        category: 'general',
      });
    }
    return next;
  }

  if (current.usingWithdrawalRate) {
    const portfolio = next.accounts.reduce((s, a) => s + a.balance, 0);
    if (portfolio > 0) {
      next.assumptions = {
        ...next.assumptions,
        withdrawalRate: Math.max(0, desiredLifestyle / portfolio),
      };
    }
    return next;
  }

  if (desiredLifestyle > 0) {
    next.assumptions = { ...next.assumptions, useSpendFromPlan: true };
    next.expenses = [
      ...next.expenses,
      {
        id: newId('grid-spend'),
        label: 'Lifestyle spending',
        annualAmount: desiredLifestyle,
        startAge: 18,
        endAge: null,
        category: 'general',
      },
    ];
  }
  return next;
}

export function applyGridScenario(plan: RetirementPlan, scenario: GridScenario): RetirementPlan {
  let next = structuredClone(plan);
  next.primary = { ...next.primary, retirementAge: scenario.retirementAge };
  if (scenario.ssClaimAge != null) {
    const claimAge = Math.min(70, Math.max(62, Math.round(scenario.ssClaimAge)));
    next.socialSecurity = next.socialSecurity.map((s) =>
      s.owner === 'primary' ? { ...s, claimAge } : s
    );
  }
  next = syncRetirementDerivedFields(next);
  next = applySpendTarget(next, scenario.spendTarget);
  const choice = bitcoinGridChoice(scenario.bitcoinId);
  if (choice.brokeragePercent != null) {
    const hysaFraction = 1 - choice.brokeragePercent / 100;
    next = liquidateBitcoinToCash(next, hysaFraction).plan;
  }
  return next;
}
