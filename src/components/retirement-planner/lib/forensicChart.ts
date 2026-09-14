import type { AccountYearSnapshot } from './forensic';
import type { FailureYearBeat } from './monteCarloCore';
import type { AccountType } from './types';

export type ForensicScale = 'usd' | 'pct' | 'units';
export type ForensicMetric = 'startUsd' | 'endUsd' | 'units' | 'price' | 'return';

export interface ForensicSeriesDef {
  id: string;
  label: string;
  group: string;
  scale: ForensicScale;
  color: string;
  dashed?: boolean;
  accountType?: AccountType;
  metric?: ForensicMetric;
  value: (year: FailureYearBeat) => number | null;
}

export interface ForensicSeriesGroup {
  title: string;
  series: ForensicSeriesDef[];
}

export interface ForensicSeriesStyle {
  color: string;
  pointStyle: string;
}

/** Account series turned on when the chart modal opens / Reset defaults. */
export const DEFAULT_FORENSIC_ACCOUNT_SERIES: { type: AccountType; metric: ForensicMetric }[] = [
  { type: 'traditionalIra', metric: 'startUsd' },
  { type: 'crypto', metric: 'endUsd' },
  { type: 'rothIra', metric: 'startUsd' },
  { type: 'bitcoin', metric: 'units' },
  { type: 'bitcoin', metric: 'price' },
  { type: 'roth401k', metric: 'startUsd' },
  { type: 'gold', metric: 'units' },
  { type: 'gold', metric: 'price' },
];

const PALETTE = [
  '#f43f5e',
  '#14b8a6',
  '#a855f7',
  '#eab308',
  '#0ea5e9',
  '#f97316',
  '#84cc16',
  '#6366f1',
  '#ec4899',
  '#22c55e',
  '#06b6d4',
  '#e11d48',
  '#8b5cf6',
  '#65a30d',
  '#0284c7',
  '#d97706',
  '#db2777',
  '#0f766e',
  '#7c3aed',
  '#ca8a04',
];

const POINT_STYLES = [
  'circle',
  'rect',
  'triangle',
  'rectRot',
  'star',
  'crossRot',
  'rectRounded',
  'dash',
] as const;

function colorAt(index: number): string {
  return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length];
}

function num(n: number | null | undefined): number | null {
  return n == null || !Number.isFinite(n) ? null : n;
}

function pctPoints(n: number | null | undefined): number | null {
  const v = num(n);
  return v == null ? null : v * 100;
}

function spendOf(year: FailureYearBeat) {
  return (
    year.spend ?? {
      general: year.expenses,
      travel: 0,
      healthInsurance: 0,
      total: year.expenses,
    }
  );
}

function accountAt(
  year: FailureYearBeat,
  id: string,
  which: 'start' | 'end'
): AccountYearSnapshot | undefined {
  const rows = which === 'start' ? year.accountsStart : year.accountsEnd;
  return rows?.find((a) => a.id === id);
}

function hasValues(timeline: FailureYearBeat[], value: ForensicSeriesDef['value']): boolean {
  return timeline.some((year) => {
    const v = value(year);
    return v != null && Number.isFinite(v);
  });
}

function uniqueAccounts(timeline: FailureYearBeat[]): AccountYearSnapshot[] {
  const byId = new Map<string, AccountYearSnapshot>();
  for (const year of timeline) {
    for (const row of [...(year.accountsEnd ?? []), ...(year.accountsStart ?? [])]) {
      if (!byId.has(row.id)) byId.set(row.id, row);
    }
  }
  return [...byId.values()];
}

function accountTitle(account: AccountYearSnapshot): string {
  const owner =
    account.owner === 'spouse' ? 'Spouse' : account.owner === 'joint' ? 'Joint' : '';
  return owner ? `${account.label} · ${owner}` : account.label;
}

/** Series catalog for a saved Monte Carlo path — year metrics plus per-account balances. */
export function buildForensicSeries(timeline: FailureYearBeat[]): ForensicSeriesDef[] {
  const series: ForensicSeriesDef[] = [];
  let colorIndex = 0;
  const add = (def: Omit<ForensicSeriesDef, 'color'> & { color?: string }) => {
    const full: ForensicSeriesDef = { ...def, color: def.color ?? colorAt(colorIndex++) };
    if (hasValues(timeline, full.value)) series.push(full);
  };

  add({
    id: 'portfolio',
    label: 'Portfolio',
    group: 'Cash flow',
    scale: 'usd',
    value: (y) => num(y.portfolio),
  });
  add({
    id: 'withdrawal',
    label: 'Withdrawals',
    group: 'Cash flow',
    scale: 'usd',
    value: (y) => num(y.withdrawal),
  });
  add({
    id: 'incomePlusSs',
    label: 'Income + SS',
    group: 'Cash flow',
    scale: 'usd',
    value: (y) => num(y.incomePlusSs),
  });
  add({
    id: 'contributions',
    label: 'Contributions',
    group: 'Cash flow',
    scale: 'usd',
    value: (y) => num(y.contributions),
  });
  add({
    id: 'rmd',
    label: 'RMD',
    group: 'Cash flow',
    scale: 'usd',
    value: (y) => num(y.rmd),
  });
  add({
    id: 'rothConversion',
    label: 'Roth conversion',
    group: 'Cash flow',
    scale: 'usd',
    value: (y) => num(y.rothConversion),
  });
  add({
    id: 'estimatedTax',
    label: 'Estimated tax',
    group: 'Cash flow',
    scale: 'usd',
    value: (y) => num(y.estimatedTax),
  });
  add({
    id: 'shortfall',
    label: 'Shortfall',
    group: 'Cash flow',
    scale: 'usd',
    value: (y) => num(y.shortfall),
  });
  add({
    id: 'expenseCut',
    label: 'Expense cut',
    group: 'Cash flow',
    scale: 'usd',
    value: (y) => num(y.expenseCut),
  });

  add({
    id: 'spendTotal',
    label: 'Spend total',
    group: 'Spending',
    scale: 'usd',
    value: (y) => num(spendOf(y).total),
  });
  add({
    id: 'spendGeneral',
    label: 'General',
    group: 'Spending',
    scale: 'usd',
    value: (y) => num(spendOf(y).general),
  });
  add({
    id: 'spendTravel',
    label: 'Travel',
    group: 'Spending',
    scale: 'usd',
    value: (y) => num(spendOf(y).travel),
  });
  add({
    id: 'spendHealth',
    label: 'Health insurance',
    group: 'Spending',
    scale: 'usd',
    value: (y) => num(spendOf(y).healthInsurance),
  });

  add({
    id: 'portfolioReturn',
    label: 'Portfolio return',
    group: 'Returns',
    scale: 'pct',
    value: (y) => pctPoints(y.portfolioReturn),
  });
  add({
    id: 'marketReturn',
    label: 'Market',
    group: 'Returns',
    scale: 'pct',
    value: (y) => pctPoints(y.marketReturn),
  });
  add({
    id: 'bitcoinReturn',
    label: 'Bitcoin',
    group: 'Returns',
    scale: 'pct',
    value: (y) => pctPoints(y.bitcoinReturn),
  });
  add({
    id: 'cryptoReturn',
    label: 'Crypto',
    group: 'Returns',
    scale: 'pct',
    value: (y) => pctPoints(y.cryptoReturn),
  });
  add({
    id: 'goldReturn',
    label: 'Gold',
    group: 'Returns',
    scale: 'pct',
    value: (y) => pctPoints(y.goldReturn),
  });
  add({
    id: 'silverReturn',
    label: 'Silver',
    group: 'Returns',
    scale: 'pct',
    value: (y) => pctPoints(y.silverReturn),
  });
  add({
    id: 'downYear',
    label: 'Down year',
    group: 'Returns',
    scale: 'pct',
    dashed: true,
    value: (y) => (y.downYear ? 100 : 0),
  });

  add({
    id: 'marketContribution',
    label: 'Market',
    group: 'Return contribution',
    scale: 'pct',
    value: (y) => pctPoints(y.marketContribution),
  });
  add({
    id: 'bitcoinContribution',
    label: 'Bitcoin',
    group: 'Return contribution',
    scale: 'pct',
    value: (y) => pctPoints(y.bitcoinContribution),
  });
  add({
    id: 'cryptoContribution',
    label: 'Crypto',
    group: 'Return contribution',
    scale: 'pct',
    value: (y) => pctPoints(y.cryptoContribution),
  });
  add({
    id: 'goldContribution',
    label: 'Gold',
    group: 'Return contribution',
    scale: 'pct',
    value: (y) => pctPoints(y.goldContribution),
  });
  add({
    id: 'silverContribution',
    label: 'Silver',
    group: 'Return contribution',
    scale: 'pct',
    value: (y) => pctPoints(y.silverContribution),
  });

  for (const account of uniqueAccounts(timeline)) {
    const group = accountTitle(account);
    const id = account.id;
    const accountType = account.type;
    add({
      id: `acct:${id}:endUsd`,
      label: 'End $',
      group,
      scale: 'usd',
      accountType,
      metric: 'endUsd',
      value: (y) => num(accountAt(y, id, 'end')?.balanceUsd),
    });
    add({
      id: `acct:${id}:startUsd`,
      label: 'Start $',
      group,
      scale: 'usd',
      dashed: true,
      accountType,
      metric: 'startUsd',
      value: (y) => num(accountAt(y, id, 'start')?.balanceUsd),
    });
    add({
      id: `acct:${id}:units`,
      label: 'Units',
      group,
      scale: 'units',
      accountType,
      metric: 'units',
      value: (y) => num(accountAt(y, id, 'end')?.units),
    });
    add({
      id: `acct:${id}:price`,
      label: 'Price',
      group,
      scale: 'usd',
      accountType,
      metric: 'price',
      value: (y) => num(accountAt(y, id, 'end')?.priceUsd),
    });
    add({
      id: `acct:${id}:return`,
      label: 'Return',
      group,
      scale: 'pct',
      accountType,
      metric: 'return',
      value: (y) => pctPoints(accountAt(y, id, 'end')?.marketReturn),
    });
  }

  return series;
}

export function groupForensicSeries(series: ForensicSeriesDef[]): ForensicSeriesGroup[] {
  const order: string[] = [];
  const map = new Map<string, ForensicSeriesDef[]>();
  for (const item of series) {
    if (!map.has(item.group)) {
      order.push(item.group);
      map.set(item.group, []);
    }
    map.get(item.group)!.push(item);
  }
  return order.map((title) => ({ title, series: map.get(title)! }));
}

export function axisIdForScale(scale: ForensicScale): 'yUsd' | 'yPct' | 'yUnits' {
  if (scale === 'pct') return 'yPct';
  if (scale === 'units') return 'yUnits';
  return 'yUsd';
}

export function defaultForensicSeriesIds(series: ForensicSeriesDef[]): string[] {
  const ids: string[] = [];
  const used = new Set<string>();
  for (const spec of DEFAULT_FORENSIC_ACCOUNT_SERIES) {
    const match = series.find(
      (item) => item.accountType === spec.type && item.metric === spec.metric && !used.has(item.id)
    );
    if (match) {
      ids.push(match.id);
      used.add(match.id);
    }
  }
  if (ids.length > 0) return ids;
  return series
    .filter((item) => item.id === 'portfolio' || item.id === 'portfolioReturn')
    .map((item) => item.id);
}

/** Distinct color + marker for whichever series are currently plotted. */
export function styleEnabledSeries(ids: readonly string[]): Record<string, ForensicSeriesStyle> {
  const styles: Record<string, ForensicSeriesStyle> = {};
  ids.forEach((id, index) => {
    styles[id] = {
      color: PALETTE[index % PALETTE.length],
      pointStyle: POINT_STYLES[index % POINT_STYLES.length],
    };
  });
  return styles;
}
