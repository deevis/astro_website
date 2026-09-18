import { ACCOUNT_TYPE_LABELS, type AccountType } from './types';
import type { SimulationEvent } from './events';
import type { AccountYearSnapshot } from './forensic';
import type { FailureCase, FailureYearBeat } from './monteCarloCore';

export type StoryTone = 'neutral' | 'good' | 'warn' | 'bad';

export interface StoryLine {
  tone: StoryTone;
  text: string;
}

export interface StoryChapter {
  age: number;
  calendarYear: number;
  title: string;
  summary: string;
  lines: StoryLine[];
}

export interface ScenarioStory {
  heading: string;
  intro: StoryLine[];
  chapters: StoryChapter[];
  closer: StoryLine[];
}

const USD = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function unitsLabel(n: number, type: AccountType): string {
  const abs = Math.abs(n);
  const digits = abs >= 100 ? 2 : abs >= 1 ? 4 : 6;
  const formatted = n.toLocaleString('en-US', { maximumFractionDigits: digits });
  if (type === 'bitcoin') return `${formatted} BTC`;
  if (type === 'gold') return `${formatted} g`;
  if (type === 'silver') return `${formatted} oz t`;
  return formatted;
}

function typeLabel(type: AccountType): string {
  return ACCOUNT_TYPE_LABELS[type] ?? type;
}

function line(text: string, tone: StoryTone = 'neutral'): StoryLine {
  return { tone, text };
}

function accountLabel(id: string, snapshots: AccountYearSnapshot[]): string {
  return snapshots.find((a) => a.id === id)?.label || id;
}

function inferredUnitSales(
  start: AccountYearSnapshot[] | undefined,
  end: AccountYearSnapshot[] | undefined
): StoryLine[] {
  if (!start?.length || !end?.length) return [];
  const endById = new Map(end.map((a) => [a.id, a]));
  const lines: StoryLine[] = [];
  for (const open of start) {
    const close = endById.get(open.id);
    if (!close || open.units == null || close.units == null) continue;
    const sold = open.units - close.units;
    if (sold <= 1e-8) continue;
    const price = close.priceUsd ?? open.priceUsd;
    const gross = price != null ? sold * price : null;
    const priceBit =
      price != null
        ? ` at ${price.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: price >= 100 ? 0 : 2 })}`
        : '';
    const grossBit = gross != null ? ` ≈ ${USD(gross)}` : '';
    lines.push(
      line(
        `Sold ${unitsLabel(sold, open.type)} of ${open.label || typeLabel(open.type)}${priceBit}${grossBit}.`,
        'warn'
      )
    );
  }
  return lines;
}

function chapterFromBeat(beat: FailureYearBeat, index: number, total: number): StoryChapter {
  const events = beat.events ?? [];
  const spend = beat.spend;
  const lines: StoryLine[] = [];
  const year = beat.calendarYear ? String(beat.calendarYear) : 'this year';
  const retPct = `${(beat.portfolioReturn * 100).toFixed(1)}%`;

  if (beat.downYear) {
    lines.push(line(`Markets were down (${retPct} portfolio return).`, 'warn'));
  } else if (beat.portfolioReturn >= 0.15) {
    lines.push(line(`A strong year: the portfolio returned ${retPct}.`, 'good'));
  } else {
    lines.push(line(`The portfolio returned ${retPct}.`));
  }

  if (beat.incomePlusSs > 0) {
    const ss = events.find((e) => e.kind === 'SocialSecurity');
    const wages = events.filter((e) => e.kind === 'Income');
    if (wages.length) {
      for (const w of wages) {
        if (w.kind !== 'Income' || w.amount <= 0) continue;
        lines.push(line(`${w.label || 'Income'}: ${USD(w.amount)}.`));
      }
    }
    if (ss && ss.kind === 'SocialSecurity' && ss.amount > 0) {
      lines.push(line(`Social Security paid ${USD(ss.amount)}.`));
    } else if (!wages.length) {
      lines.push(line(`Income and Social Security together: ${USD(beat.incomePlusSs)}.`));
    }
  }

  if (beat.contributions > 0) {
    lines.push(line(`Payroll and other contributions added ${USD(beat.contributions)}.`));
  }

  const rothEvents = events.filter((e) => e.kind === 'RothConversion');
  if (rothEvents.length) {
    for (const e of rothEvents) {
      if (e.kind !== 'RothConversion') continue;
      lines.push(
        line(
          `Moved ${USD(e.amount)} from traditional accounts into Roth (est. tax ${USD(e.estimatedTax)})${e.reason ? ` — ${e.reason}` : ''}.`,
          'good'
        )
      );
    }
  } else if (beat.rothConversion > 0) {
    lines.push(
      line(`Moved ${USD(beat.rothConversion)} from traditional accounts into Roth.`, 'good')
    );
  }

  const sales = events.filter((e) => e.kind === 'AthHarvestSale');
  if (sales.length) {
    for (const e of sales) {
      if (e.kind !== 'AthHarvestSale') continue;
      const policy = e.policyId === 'alt-trim-policy' ? 'Allocation trim' : 'ATH harvest';
      const units =
        e.unitsSold != null && e.unitsSold > 0
          ? ` ${unitsLabel(e.unitsSold, e.accountType)} of`
          : '';
      const price =
        e.priceUsd != null && e.priceUsd > 0
          ? ` at ${e.priceUsd.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: e.priceUsd >= 100 ? 0 : 2 })}`
          : '';
      const acct = accountLabel(e.accountId, beat.accountsEnd ?? beat.accountsStart ?? []);
      lines.push(
        line(
          `${policy} sold${units} ${acct} (${typeLabel(e.accountType)})${price} for ${USD(e.grossUsd)} gross, ${USD(e.netUsd)} net after ${USD(e.taxUsd)} tax.`,
          'warn'
        )
      );
    }
  } else {
    lines.push(...inferredUnitSales(beat.accountsStart, beat.accountsEnd));
  }

  const spendWithdraws = events.filter(
    (e) => e.kind === 'SpendingWithdraw' && e.reason !== 'Federal tax payment'
  );
  if (spendWithdraws.length) {
    const byType = new Map<AccountType, number>();
    for (const e of spendWithdraws) {
      if (e.kind !== 'SpendingWithdraw') continue;
      byType.set(e.accountType, (byType.get(e.accountType) ?? 0) + e.amount);
    }
    for (const [type, amount] of byType) {
      if (amount <= 0) continue;
      lines.push(line(`Withdrew ${USD(amount)} from ${typeLabel(type)} for spending.`));
    }
  } else if (beat.withdrawal > 0) {
    lines.push(line(`Portfolio withdrawals for spending: ${USD(beat.withdrawal)}.`));
  }

  const health = spend?.healthInsurance ?? 0;
  if (health > 0) {
    lines.push(
      line(`Health insurance premiums (Medicare-gap and/or Part B) cost ${USD(health)}.`)
    );
  }

  const spendTotal = spend?.total ?? beat.expenses;
  if (spendTotal > 0) {
    const bits: string[] = [];
    if ((spend?.general ?? 0) > 0) bits.push(`living ${USD(spend.general)}`);
    if ((spend?.travel ?? 0) > 0) bits.push(`travel ${USD(spend.travel)}`);
    const extra = bits.length ? ` (${bits.join(', ')})` : '';
    lines.push(line(`Spent ${USD(spendTotal)}${extra}.`));
  }

  if (beat.expenseCut > 0) {
    lines.push(line(`Down-year policy cut spending by ${USD(beat.expenseCut)}.`, 'warn'));
  }

  if (beat.rmd > 0) {
    const rmdEvent = events.find((e) => e.kind === 'Rmd');
    lines.push(
      line(
        `Required minimum distribution ${USD(beat.rmd)}${rmdEvent && rmdEvent.kind === 'Rmd' && rmdEvent.appliedToSpending > 0 ? ` (${USD(rmdEvent.appliedToSpending)} covered spending)` : ''}.`
      )
    );
  }

  const taxEvent = events.find((e) => e.kind === 'TaxEstimate');
  if (taxEvent && taxEvent.kind === 'TaxEstimate' && taxEvent.totalTax > 0) {
    lines.push(
      line(
        `Estimated federal tax ${USD(taxEvent.totalTax)} (ordinary ${USD(taxEvent.ordinaryTax)}, LTCG ${USD(taxEvent.ltcgTax)}; MAGI ${USD(taxEvent.magi)}).`
      )
    );
  } else if (beat.estimatedTax > 0) {
    lines.push(line(`Estimated federal tax ${USD(beat.estimatedTax)}.`));
  }

  for (const e of events) {
    if (e.kind === 'PolicyNote' && e.note) lines.push(line(e.note));
  }

  if (beat.shortfall > 1) {
    lines.push(line(`Spending shortfall of ${USD(beat.shortfall)} — cash did not cover the year’s need.`, 'bad'));
  }

  lines.push(line(`Portfolio at year-end: ${USD(beat.portfolio)}.`));

  const highlights = lines.filter((l) => l.tone !== 'neutral');
  const summary = highlights[0]?.text
    ?? (index === 0
      ? `Opening chapter for ${year}.`
      : index === total - 1
        ? `Final year in this path.`
        : `Age ${beat.age} in ${year}.`);

  return {
    age: beat.age,
    calendarYear: beat.calendarYear,
    title: `Age ${beat.age} · ${year}`,
    summary,
    lines,
  };
}

function pathLabel(kind: FailureCase['kind']): string {
  if (kind === 'moonshot') return 'Moonshot path';
  if (kind === 'average') return 'Typical path';
  if (kind === 'worst') return 'Lower-tail path';
  return 'Failure path';
}

export function buildScenarioStory(scenario: FailureCase): ScenarioStory {
  const chapters = scenario.timeline.map((beat, i) =>
    chapterFromBeat(beat, i, scenario.timeline.length)
  );
  const rothTotal = scenario.timeline.reduce((s, y) => s + (y.rothConversion ?? 0), 0);
  const rothYears = scenario.timeline.filter((y) => (y.rothConversion ?? 0) > 0).length;
  const insuranceTotal = scenario.timeline.reduce(
    (s, y) => s + (y.spend?.healthInsurance ?? 0),
    0
  );
  const harvestEvents = scenario.timeline.flatMap((y) =>
    (y.events ?? []).filter((e): e is Extract<SimulationEvent, { kind: 'AthHarvestSale' }> => e.kind === 'AthHarvestSale')
  );
  const harvestGross = harvestEvents.reduce((s, e) => s + e.grossUsd, 0);
  const harvestNet = harvestEvents.reduce((s, e) => s + e.netUsd, 0);
  const intro: StoryLine[] = [
    line(
      `${pathLabel(scenario.kind)} #${scenario.runIndex} ended at ${USD(scenario.endingBalance)} after peaking at ${USD(scenario.peakPortfolio)} (age ${scenario.peakAge}).`
    ),
    line(`Max drawdown ${(scenario.maxDrawdownPct * 100).toFixed(0)}%.`),
  ];
  if (rothTotal > 0) {
    intro.push(
      line(
        `Roth conversions moved ${USD(rothTotal)} out of traditional accounts across ${rothYears} year${rothYears === 1 ? '' : 's'}.`,
        'good'
      )
    );
  } else {
    intro.push(line('No Roth conversions on this path.'));
  }
  if (harvestEvents.length) {
    intro.push(
      line(
        `Asset sales (ATH harvest / allocation trim) totaled ${USD(harvestGross)} gross, ${USD(harvestNet)} net, over ${harvestEvents.length} sale${harvestEvents.length === 1 ? '' : 's'}.`,
        'warn'
      )
    );
  }
  if (insuranceTotal > 0) {
    intro.push(line(`Health insurance premiums across the path: ${USD(insuranceTotal)}.`));
  }
  if (scenario.depletedAge != null) {
    intro.push(line(`The portfolio was depleted at age ${scenario.depletedAge}.`, 'bad'));
  } else if (scenario.firstShortfallAge != null) {
    intro.push(line(`First spending shortfall at age ${scenario.firstShortfallAge}.`, 'bad'));
  }

  const closer: StoryLine[] = [...(scenario.circumstances ?? []).map((text) => line(text))];
  closer.push(
    line(
      `This is a reconstruction of one simulated path, not a forecast. Re-run Monte Carlo to sample other sequences.`
    )
  );

  return {
    heading: `${pathLabel(scenario.kind)} · run #${scenario.runIndex}`,
    intro,
    chapters,
    closer,
  };
}
