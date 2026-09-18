<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { get } from 'svelte/store';
  import { dialogFocus } from '../lib/dialogFocus';
  import { planStore } from '../lib/planStore';
  import { money } from '../lib/cashflow';
  import { loadChartJs, type ChartInstance } from '../lib/loadChart';
  import {
    cancelMonteCarlo,
    runMonteCarlo,
    scenarioExportPayload,
    summarizeEndingBalances,
    type FailureCase,
    type FailureYearBeat,
    type MonteCarloResult,
  } from '../lib/monteCarlo';
  import type { AccountYearSnapshot } from '../lib/forensic';
  import {
    axisIdForScale,
    buildForensicSeries,
    defaultForensicSeriesIds,
    groupForensicSeries,
    styleEnabledSeries,
    type ForensicSeriesDef,
  } from '../lib/forensicChart';
  import { compareRothOnOff, type PolicyComparisonResult } from '../lib/policyComparison';
  import { readyForProjection } from '../lib/planHealth';
  import { buildScenarioStory } from '../lib/scenarioStory';
  import {
    BIRTH_MONTH_LABELS,
    remainingWorkYears,
    resolvedBirthMonth,
    retirementDate,
    describeBitcoinSellPlaybook,
    incomeEndsAtRetirement,
    nominalAnnualSpendAtAge,
    type SpendLine,
  } from '../lib/types';
  import {
    bitcoinHoldingsUsd,
    liquidateBitcoinToCash,
    previewBitcoinLiquidation,
  } from '../lib/bitcoinLiquidation';
  import {
    applyGridScenario,
    BITCOIN_GRID_CHOICES,
    buildMonteCarloGrid,
    GRID_CELL_COUNT,
    type BitcoinGridChoiceId,
    type GridAxisValue,
    type GridInelasticAxis,
    type GridScenario,
    type GridSpec,
  } from '../lib/monteCarloGrid';
  import PlannerPanel from '../PlannerPanel.svelte';
  import EmptyState from '../EmptyState.svelte';

  $: planReady = readyForProjection($planStore);

  type GridCellView = {
    row: number;
    col: number;
    scenario: GridScenario;
    status: 'pending' | 'running' | 'done' | 'error';
    successRate?: number;
    meetsThreshold?: boolean;
    medianEnding?: number;
    p25Ending?: number;
    p75Ending?: number;
    meanEnding?: number;
    stdevEnding?: number;
  };

  let running = false;
  let runId = 0;
  let progress = 0;
  let progressTotal = 0;
  let error = '';
  let result: MonteCarloResult | null = null;
  let scenarioTab: 'failures' | 'average' | 'moonshots' = 'failures';
  let selectedCase: FailureCase | null = null;
  let expandedAge: number | null = null;
  let confirmOpen = false;
  let jsonOpen = false;
  let storyOpen = false;
  let jsonText = '';
  let jsonCopied = false;
  let jsonCopyTimer: ReturnType<typeof setTimeout> | undefined;
  let chartOpen = false;
  let forensicCatalog: ForensicSeriesDef[] = [];
  let forensicEnabledIds: string[] = [];
  let forensicCanvas: HTMLCanvasElement;
  let forensicChart: ChartInstance | null = null;
  let forensicRender = 0;
  let confirmInsurance = 750;
  let confirmLiquidateBitcoin = false;
  let confirmHysaPercent = 100;
  let policyComparison: PolicyComparisonResult | null = null;
  let runKind: 'single' | 'grid' | null = null;
  let gridInelastic: GridInelasticAxis = 'bitcoin';
  let gridLockedBitcoinId: BitcoinGridChoiceId = 'hold';
  let gridSpec: GridSpec | null = null;
  let gridCells: GridCellView[] = [];
  let gridCollapsed = false;
  let spendTip: {
    x: number;
    y: number;
    title: string;
    lines: { label: string; amount: number; upcoming?: boolean }[];
    total: number;
    stats?: {
      successRate: number;
      p25: number;
      p50: number;
      p75: number;
      mean: number;
      stdev: number;
    };
  } | null = null;

  $: salarySummary = summarizePreRetirementSalary($planStore);
  $: ssSummaries = summarizeSocialSecurity($planStore);
  $: startSpend = nominalAnnualSpendAtAge(
    $planStore,
    $planStore.primary.currentAge,
    { monthlyInsuranceUntilMedicare: confirmInsurance }
  );
  $: bitcoinPlaybook = describeBitcoinSellPlaybook($planStore);
  $: bitcoinHoldings = bitcoinHoldingsUsd($planStore);
  $: bitcoinLiquidationPreview =
    confirmOpen && confirmLiquidateBitcoin
      ? previewBitcoinLiquidation($planStore, confirmHysaPercent / 100)
      : { gross: 0, tax: 0, net: 0, gain: 0, toHysa: 0, toBrokerage: 0, unitsSold: 0 };
  $: medicareGapYears = Math.max(
    0,
    Math.min($planStore.primary.medicareStartAge, $planStore.primary.lifeExpectancy) -
      Math.max($planStore.primary.currentAge, $planStore.primary.retirementAge)
  );
  $: gridPreview = planReady
    ? buildMonteCarloGrid($planStore, {
        inelastic: gridInelastic,
        lockedBitcoinId: gridLockedBitcoinId,
      })
    : null;
  $: displayGrid = gridSpec ?? gridPreview;
  $: gridDoneCount = gridCells.filter((c) => c.status === 'done').length;
  $: gridBestKey = bestGridCellKey(gridCells);
  $: gridCellByKey = new Map(gridCells.map((c) => [`${c.row}:${c.col}`, c]));
  $: hasGridResults = gridCells.some((c) => c.status === 'done');
  $: scenarioStory = selectedCase ? buildScenarioStory(selectedCase) : null;

  function summarizePreRetirementSalary(plan: typeof $planStore) {
    const asOf = new Date();
    const years = remainingWorkYears(
      plan.primary.currentAge,
      plan.primary.retirementAge,
      plan.primary.birthMonth,
      asOf
    );
    const streams = plan.income.filter(
      (s) =>
        incomeEndsAtRetirement(s, plan.income) &&
        (s.owner === 'primary' || s.owner === 'joint')
    );
    const annual = streams.reduce((sum, s) => sum + Math.max(0, s.annualAmount), 0);
    const month = resolvedBirthMonth(plan.primary.birthMonth);
    const retireAt = retirementDate(
      plan.primary.currentAge,
      plan.primary.retirementAge,
      plan.primary.birthMonth,
      asOf
    );
    return {
      years,
      annual,
      totalNominal: annual * years,
      labels: streams.map((s) => s.label).filter(Boolean),
      birthMonthLabel: BIRTH_MONTH_LABELS[month - 1],
      retireYear: retireAt.getFullYear(),
      asOfYear: asOf.getFullYear(),
    };
  }

  function summarizeSocialSecurity(plan: typeof $planStore) {
    return plan.socialSecurity.map((s) => {
      const person =
        s.owner === 'spouse' && plan.spouse ? plan.spouse : plan.primary;
      return {
        owner: s.owner,
        name: person.name || (s.owner === 'spouse' ? 'Spouse' : 'You'),
        claimAge: s.claimAge,
        monthly: s.estimatedMonthlyBenefit ?? null,
        annual: s.estimatedMonthlyBenefit != null ? s.estimatedMonthlyBenefit * 12 : null,
      };
    });
  }

  function openConfirm() {
    if (!planReady || running) return;
    confirmInsurance =
      $planStore.taxStrategy.monthlyInsuranceUntilMedicare ?? 750;
    confirmLiquidateBitcoin = false;
    confirmHysaPercent = 100;
    confirmOpen = true;
    error = '';
    spendTip = null;
  }

  function closeConfirm() {
    confirmOpen = false;
  }

  async function confirmAndRun() {
    const liquidateBitcoin = confirmLiquidateBitcoin && bitcoinHoldings.usd > 0;
    const hysaFraction = Math.min(1, Math.max(0, confirmHysaPercent / 100));
    planStore.update((plan) => ({
      ...plan,
      taxStrategy: {
        ...plan.taxStrategy,
        monthlyInsuranceUntilMedicare: Math.max(0, Number(confirmInsurance) || 0),
      },
    }));
    confirmOpen = false;
    await startRun({ liquidateBitcoin, hysaFraction });
  }

  let fanCanvas: HTMLCanvasElement;
  let histCanvas: HTMLCanvasElement;
  let caseCanvas: HTMLCanvasElement;
  let fanChart: ChartInstance | null = null;
  let histChart: ChartInstance | null = null;
  let caseChart: ChartInstance | null = null;

  $: activeCases =
    result == null
      ? []
      : scenarioTab === 'moonshots'
        ? result.moonshotCases ?? []
        : scenarioTab === 'average'
          ? result.averageCases ?? []
          : result.failureCases;

  $: forensicGroups = groupForensicSeries(forensicCatalog);
  $: forensicStyleById = styleEnabledSeries(forensicEnabledIds);

  onDestroy(() => {
    runId++;
    cancelMonteCarlo();
    fanChart?.destroy();
    histChart?.destroy();
    caseChart?.destroy();
    forensicChart?.destroy();
    if (jsonCopyTimer) clearTimeout(jsonCopyTimer);
    spendTip = null;
    storyOpen = false;
  });

  async function startRun(override: { liquidateBitcoin?: boolean; hysaFraction?: number } = {}) {
    const currentRun = ++runId;
    error = '';
    running = true;
    progress = 0;
    progressTotal = get(planStore).assumptions.monteCarloRuns;
    result = null;
    policyComparison = null;
    fanChart?.destroy(); fanChart = null;
    histChart?.destroy(); histChart = null;
    caseChart?.destroy(); caseChart = null;
    selectedCase = null;
    expandedAge = null;
    closeCharts();
    jsonOpen = false;
    storyOpen = false;
    scenarioTab = 'failures';
    runKind = 'single';
    gridCollapsed = true;

    try {
      let plan = structuredClone(get(planStore));
      if (override.liquidateBitcoin) {
        plan = liquidateBitcoinToCash(plan, override.hysaFraction ?? 1).plan;
      }
      const mc = await runMonteCarlo(plan, {
        onProgress: (p) => {
          if (currentRun !== runId) return;
          progress = p.completed;
          progressTotal = p.total;
        },
      });
      if (currentRun !== runId) return;
      result = {
        ...mc,
        moonshotCases: mc.moonshotCases ?? [],
        averageCases: mc.averageCases ?? [],
      };
      if (mc.failureCases.length) {
        scenarioTab = 'failures';
        selectedCase = mc.failureCases[0];
      } else if ((mc.averageCases?.length ?? 0) > 0) {
        scenarioTab = 'average';
        selectedCase = mc.averageCases![0];
      } else if ((mc.moonshotCases?.length ?? 0) > 0) {
        scenarioTab = 'moonshots';
        selectedCase = mc.moonshotCases![0];
      }
      await tick();
      await renderCharts(result, currentRun);
      if (currentRun !== runId) return;
      if (selectedCase) await renderCaseChart(selectedCase);
      if (currentRun === runId) policyComparison = compareRothOnOff(plan, mc.simulationMeta.seed);
    } catch (e) {
      if (currentRun !== runId || (e instanceof Error && e.name === 'AbortError')) return;
      error = e instanceof Error ? e.message : 'Monte Carlo failed';
    } finally {
      if (currentRun === runId) {
        running = false;
        if (runKind === 'single') runKind = null;
      }
    }
  }

  function stopRun() {
    runId++;
    cancelMonteCarlo();
    running = false;
    runKind = null;
    gridCells = gridCells.map((c) =>
      c.status === 'running' ? { ...c, status: 'pending' as const } : c
    );
  }

  function bestGridCellKey(cells: GridCellView[]): string | null {
    const done = cells.filter((c) => c.status === 'done' && c.successRate != null);
    if (!done.length) return null;
    let best = done[0]!;
    for (const cell of done) {
      const rate = cell.successRate ?? 0;
      const bestRate = best.successRate ?? 0;
      if (rate > bestRate + 1e-9) best = cell;
      else if (Math.abs(rate - bestRate) <= 1e-9 && (cell.medianEnding ?? 0) > (best.medianEnding ?? 0)) {
        best = cell;
      }
    }
    return `${best.row}:${best.col}`;
  }

  function patchGridCell(index: number, patch: Partial<GridCellView>) {
    gridCells = gridCells.map((cell, j) => (j === index ? { ...cell, ...patch } : cell));
  }

  function gridCellFill(cell: GridCellView | undefined): string {
    if (!cell || cell.status === 'pending') return 'transparent';
    if (cell.status === 'running') {
      return 'linear-gradient(165deg, rgba(251, 191, 36, 0.38), rgba(217, 119, 6, 0.5))';
    }
    if (cell.status === 'error') {
      return 'linear-gradient(165deg, rgba(248, 113, 113, 0.45), rgba(185, 28, 28, 0.6))';
    }
    const rate = Math.min(1, Math.max(0, cell.successRate ?? 0));
    if (rate < 0.7) {
      const t = rate / 0.7;
      const top = 0.9 - t * 0.18;
      const bot = 0.96 - t * 0.12;
      return `linear-gradient(165deg, rgba(248, 113, 113, ${top}), rgba(153, 27, 27, ${bot}))`;
    }
    if (rate < 0.8) {
      const t = (rate - 0.7) / 0.1;
      const top = 0.82 - t * 0.12;
      const bot = 0.92 - t * 0.1;
      return `linear-gradient(165deg, rgba(253, 186, 116, ${top}), rgba(194, 65, 12, ${bot}))`;
    }
    if (rate < 0.9) {
      const t = (rate - 0.8) / 0.1;
      const top = 0.5 + t * 0.08;
      const bot = 0.58 + t * 0.08;
      return `linear-gradient(165deg, rgba(153, 246, 228, ${top}), rgba(15, 118, 110, ${bot}))`;
    }
    const t = (rate - 0.9) / 0.1;
    const top = 0.62 + t * 0.16;
    const bot = 0.78 + t * 0.12;
    return `linear-gradient(165deg, rgba(74, 222, 128, ${top}), rgba(21, 128, 61, ${bot}))`;
  }

  function baselineCaption(axis: GridInelasticAxis): string {
    if (axis === 'retirementAge') return 'Target';
    if (axis === 'spend') return 'Current';
    return '';
  }

  function baselineHeaderClass(isDefault: boolean, sticky: boolean, wrap = false): string {
    const rest = sticky
      ? `sticky left-0 z-10 px-2 py-1.5 text-left border-b ${wrap ? 'whitespace-normal max-w-[13rem]' : 'whitespace-nowrap'}`
      : `px-1.5 py-1.5 text-center border-b ${wrap ? 'whitespace-normal' : 'whitespace-nowrap'}`;
    if (!isDefault) {
      return sticky
        ? `${rest} bg-white dark:bg-gray-900 font-medium text-gray-700 dark:text-gray-300 border-gray-100 dark:border-gray-800`
        : `${rest} font-medium text-gray-500 border-gray-200 dark:border-gray-700`;
    }
    return sticky
      ? `${rest} bg-sky-100 dark:bg-sky-950/80 font-semibold text-sky-900 dark:text-sky-100 border-sky-200 dark:border-sky-800 shadow-[inset_3px_0_0_0_rgb(14,165,233)]`
      : `${rest} bg-sky-100 dark:bg-sky-950/80 font-semibold text-sky-900 dark:text-sky-100 border-sky-300 dark:border-sky-700 shadow-[inset_0_3px_0_0_rgb(14,165,233)]`;
  }

  function spendTipPosition(event: MouseEvent) {
    const width = 300;
    const height = 360;
    let x = event.clientX + 12;
    let y = event.clientY + 16;
    if (x + width > window.innerWidth - 8) x = event.clientX - width - 8;
    if (y + height > window.innerHeight - 8) y = event.clientY - height - 8;
    return { x: Math.max(8, x), y: Math.max(8, y) };
  }

  function openSpendTip(
    event: MouseEvent,
    title: string,
    lines: { label: string; amount: number; upcoming?: boolean }[] | undefined,
    total?: number,
    stats?: {
      successRate: number;
      p25: number;
      p50: number;
      p75: number;
      mean: number;
      stdev: number;
    }
  ) {
    const usable = (lines ?? []).filter((l) => l.amount > 0);
    if (!usable.length && !stats) {
      spendTip = null;
      return;
    }
    spendTip = {
      ...spendTipPosition(event),
      title,
      lines: usable,
      total: total ?? usable.filter((l) => !l.upcoming).reduce((s, l) => s + l.amount, 0),
      stats,
    };
  }

  function moveSpendTip(event: MouseEvent) {
    if (!spendTip) return;
    spendTip = { ...spendTip, ...spendTipPosition(event) };
  }

  function closeSpendTip() {
    spendTip = null;
  }

  function spendAxisOf(row: GridAxisValue, col: GridAxisValue): {
    spendLines?: SpendLine[];
    spendTotal?: number;
  } | null {
    if (col.spendLines && col.spendLines.length) return col;
    if (row.spendLines && row.spendLines.length) return row;
    if (displayGrid?.locked.spendLines?.length) return displayGrid.locked;
    return null;
  }

  function setGridInelastic(axis: GridInelasticAxis) {
    gridInelastic = axis;
    if (!running) {
      gridSpec = null;
      gridCells = [];
    }
  }

  async function startGrid() {
    if (!planReady || running) return;
    const currentRun = ++runId;
    error = '';
    running = true;
    runKind = 'grid';
    gridCollapsed = false;
    const plan = structuredClone(get(planStore));
    const spec = buildMonteCarloGrid(plan, {
      inelastic: gridInelastic,
      lockedBitcoinId: gridLockedBitcoinId,
    });
    gridSpec = spec;
    gridCells = spec.cells.map((c) => ({ ...c, status: 'pending' as const }));
    const runs = plan.assumptions.monteCarloRuns;
    const seed = Date.now();
    progress = 0;
    progressTotal = spec.cells.length * runs;
    await tick();

    try {
      for (let i = 0; i < spec.cells.length; i++) {
        if (currentRun !== runId) return;
        const pending = spec.cells[i]!;
        patchGridCell(i, { status: 'running' });
        await tick();
        const variant = applyGridScenario(plan, pending.scenario);
        const mc = await runMonteCarlo(variant, {
          runs,
          seed,
          onProgress: (p) => {
            if (currentRun !== runId) return;
            progress = i * runs + p.completed;
            progressTotal = spec.cells.length * runs;
          },
        });
        if (currentRun !== runId) return;
        const ending = summarizeEndingBalances(mc.endingBalances);
        patchGridCell(i, {
          status: 'done',
          successRate: mc.successRate,
          meetsThreshold: mc.meetsThreshold,
          medianEnding: ending.p50,
          p25Ending: ending.p25,
          p75Ending: ending.p75,
          meanEnding: ending.mean,
          stdevEnding: ending.stdev,
        });
        progress = (i + 1) * runs;
        await tick();
      }
    } catch (e) {
      if (currentRun !== runId || (e instanceof Error && e.name === 'AbortError')) return;
      error = e instanceof Error ? e.message : 'Grid simulation failed';
      gridCells = gridCells.map((c) =>
        c.status === 'running' ? { ...c, status: 'error' as const } : c
      );
    } finally {
      if (currentRun === runId) {
        running = false;
        runKind = null;
      }
    }
  }

  async function renderCharts(mc: MonteCarloResult, currentRun: number) {
    const Chart = await loadChartJs();
    if (currentRun !== runId || !fanCanvas?.isConnected) return;
    const isDark = document.documentElement.classList.contains('dark');
    const tickColor = isDark ? '#94a3b8' : '#64748b';
    const grid = isDark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.15)';

    if (fanCanvas) {
      fanChart?.destroy();
      fanChart = new Chart(fanCanvas, {
        type: 'line',
        data: {
          labels: mc.ages.map(String),
          datasets: [
            {
              label: '90th percentile',
              data: mc.p90,
              borderColor: '#86efac',
              backgroundColor: 'transparent',
              pointRadius: 0,
              borderWidth: 1.5,
              tension: 0.2,
            },
            {
              label: 'Median (50th)',
              data: mc.p50,
              borderColor: '#2563eb',
              backgroundColor: 'rgba(37,99,235,0.1)',
              fill: '+1',
              pointRadius: 0,
              borderWidth: 2.5,
              tension: 0.2,
            },
            {
              label: '10th percentile',
              data: mc.p10,
              borderColor: '#fca5a5',
              backgroundColor: 'rgba(37,99,235,0.08)',
              fill: false,
              pointRadius: 0,
              borderWidth: 1.5,
              tension: 0.2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: tickColor, boxWidth: 12, font: { size: 11 } } },
            tooltip: {
              callbacks: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                label(ctx: any) {
                  return `${ctx.dataset.label}: ${money(ctx.parsed.y ?? 0)}`;
                },
              },
            },
          },
          scales: {
            x: {
              title: { display: true, text: 'Age', color: tickColor },
              ticks: { color: tickColor, maxTicksLimit: 16 },
              grid: { color: grid },
            },
            y: {
              title: { display: true, text: 'Portfolio ($)', color: tickColor },
              ticks: {
                color: tickColor,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                callback: (v: any) => '$' + Number(v).toLocaleString(),
              },
              grid: { color: grid },
            },
          },
        },
      });
    }

    if (histCanvas) {
      histChart?.destroy();
      const histColors = mc.histogram.map((b) => {
        if (b.overflow) {
          return isDark ? 'rgba(245,158,11,0.65)' : 'rgba(217,119,6,0.65)';
        }
        if (b.binStart === 0 && b.binEnd === 0) {
          return isDark ? 'rgba(248,113,113,0.65)' : 'rgba(220,38,38,0.55)';
        }
        return isDark ? 'rgba(59,130,246,0.55)' : 'rgba(37,99,235,0.55)';
      });
      histChart = new Chart(histCanvas, {
        type: 'bar',
        data: {
          labels: mc.histogram.map((b) => {
            if (b.overflow) return `≥ ${money(b.binStart)}`;
            if (b.binStart === 0 && b.binEnd === 0) return '$0';
            return `${money(b.binStart)}–${money(b.binEnd)}`;
          }),
          datasets: [
            {
              label: 'Ending balance frequency',
              data: mc.histogram.map((b) => b.count),
              backgroundColor: histColors,
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                title(items: any[]) {
                  const i = items[0]?.dataIndex ?? 0;
                  const b = mc.histogram[i];
                  if (!b) return '';
                  if (b.overflow) return `≥ ${money(b.binStart)} (right-tail outliers)`;
                  if (b.binStart === 0 && b.binEnd === 0) return '$0 (portfolio depleted)';
                  return `${money(b.binStart)} – ${money(b.binEnd)}`;
                },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                label(ctx: any) {
                  return `${ctx.parsed.y ?? 0} runs`;
                },
              },
            },
          },
          scales: {
            x: {
              ticks: { color: tickColor, maxRotation: 60, minRotation: 45, font: { size: 9 } },
              grid: { display: false },
            },
            y: {
              title: { display: true, text: 'Runs', color: tickColor },
              ticks: { color: tickColor },
              grid: { color: grid },
              beginAtZero: true,
            },
          },
        },
      });
    }
  }

  async function setScenarioTab(tab: 'failures' | 'average' | 'moonshots') {
    scenarioTab = tab;
    const list =
      tab === 'moonshots'
        ? result?.moonshotCases ?? []
        : tab === 'average'
          ? result?.averageCases ?? []
          : result?.failureCases ?? [];
    selectedCase = list[0] ?? null;
    expandedAge = null;
    await tick();
    if (selectedCase) await renderCaseChart(selectedCase);
  }

  async function selectCase(f: FailureCase) {
    selectedCase = f;
    expandedAge = null;
    await tick();
    await renderCaseChart(f);
  }

  function caseAccent(): { line: string; fill: string; panel: string; btn: string } {
    if (scenarioTab === 'moonshots') {
      return {
        line: '#059669',
        fill: 'rgba(5,150,105,0.12)',
        panel:
          'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20',
        btn: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200',
      };
    }
    if (scenarioTab === 'average') {
      return {
        line: '#2563eb',
        fill: 'rgba(37,99,235,0.12)',
        panel: 'border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20',
        btn: 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200',
      };
    }
    return {
      line: '#dc2626',
      fill: 'rgba(220,38,38,0.1)',
      panel: 'border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20',
      btn: 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200',
    };
  }

  async function renderCaseChart(f: FailureCase) {
    if (!caseCanvas) return;
    const currentRun = runId;
    const Chart = await loadChartJs();
    if (currentRun !== runId || selectedCase !== f || !caseCanvas?.isConnected) return;
    const isDark = document.documentElement.classList.contains('dark');
    const tickColor = isDark ? '#94a3b8' : '#64748b';
    const grid = isDark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.15)';
    const accent = caseAccent();

    caseChart?.destroy();
    caseChart = new Chart(caseCanvas, {
      type: 'line',
      data: {
        labels: f.timeline.map((t) => String(t.age)),
        datasets: [
          {
            label: 'Portfolio',
            data: f.timeline.map((t) => t.portfolio),
            borderColor: accent.line,
            backgroundColor: accent.fill,
            fill: true,
            pointRadius: 0,
            borderWidth: 2,
            yAxisID: 'y',
            tension: 0.15,
          },
          {
            label: 'Annual return %',
            data: f.timeline.map((t) => t.portfolioReturn * 100),
            borderColor: '#a855f7',
            pointRadius: 0,
            borderWidth: 1.5,
            yAxisID: 'y1',
            tension: 0.15,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: tickColor, boxWidth: 12, font: { size: 11 } } },
        },
        scales: {
          x: {
            title: { display: true, text: 'Age', color: tickColor },
            ticks: { color: tickColor, maxTicksLimit: 14 },
            grid: { color: grid },
          },
          y: {
            position: 'left',
            title: { display: true, text: 'Portfolio ($)', color: tickColor },
            ticks: {
              color: tickColor,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              callback: (v: any) => '$' + Number(v).toLocaleString(),
            },
            grid: { color: grid },
          },
          y1: {
            position: 'right',
            title: { display: true, text: 'Return (%)', color: tickColor },
            ticks: { color: tickColor },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });
  }

  function pct(n: number): string {
    return `${(n * 100).toFixed(1)}%`;
  }

  /** Class return with portfolio contribution in percentage points. */
  function sleeveLabel(rate: number | null | undefined, contribution: number | undefined): string {
    if (rate == null) return '—';
    const pp = contribution ?? 0;
    const sign = pp >= 0 ? '+' : '';
    return `${(rate * 100).toFixed(1)}% (${sign}${(pp * 100).toFixed(1)}pp)`;
  }

  function sleeveClass(rate: number | null | undefined): string {
    if (rate == null) return '';
    if (rate < 0) return 'text-red-600 dark:text-red-400';
    if (rate > 0.2) return 'text-emerald-700 dark:text-emerald-400';
    return '';
  }

  function toggleYear(age: number) {
    expandedAge = expandedAge === age ? null : age;
  }

  function yearSpend(t: FailureYearBeat) {
    return (
      t.spend ?? {
        general: t.expenses,
        travel: 0,
        healthInsurance: 0,
        total: t.expenses,
      }
    );
  }

  function formatUnits(n: number | null | undefined): string {
    if (n == null || !Number.isFinite(n)) return '—';
    const abs = Math.abs(n);
    const digits = abs >= 1000 ? 4 : abs >= 1 ? 6 : 8;
    return n.toLocaleString(undefined, { maximumFractionDigits: digits });
  }

  function formatPrice(n: number | null | undefined): string {
    if (n == null || !Number.isFinite(n)) return '—';
    return money(n, n >= 100 ? 2 : 4);
  }

  function ownerLabel(owner: string): string {
    if (owner === 'spouse') return 'Spouse';
    if (owner === 'joint') return 'Joint';
    return 'Primary';
  }

  function storyToneClass(tone: string): string {
    if (tone === 'good') return 'text-emerald-800 dark:text-emerald-300';
    if (tone === 'warn') return 'text-amber-800 dark:text-amber-300';
    if (tone === 'bad') return 'text-red-700 dark:text-red-400';
    return '';
  }

  function openScenarioJson() {
    if (!selectedCase || !result) return;
    closeCharts();
    storyOpen = false;
    jsonText = JSON.stringify(
      scenarioExportPayload(selectedCase, {
        tab: scenarioTab,
        batchSimulationMeta: result.simulationMeta,
      }),
      null,
      2
    );
    jsonCopied = false;
    jsonOpen = true;
  }

  function closeStory() {
    storyOpen = false;
  }

  function closeJson() {
    jsonOpen = false;
    jsonCopied = false;
  }

  function openScenarioStory() {
    if (!selectedCase) return;
    closeCharts();
    jsonOpen = false;
    storyOpen = true;
  }

  async function copyScenarioJson() {
    try {
      await navigator.clipboard.writeText(jsonText);
      jsonCopied = true;
      if (jsonCopyTimer) clearTimeout(jsonCopyTimer);
      jsonCopyTimer = setTimeout(() => {
        jsonCopied = false;
      }, 2000);
    } catch {
      jsonCopied = false;
    }
  }

  function closeCharts() {
    forensicRender++;
    chartOpen = false;
    forensicChart?.destroy();
    forensicChart = null;
  }

  async function openScenarioCharts() {
    if (!selectedCase) return;
    jsonOpen = false;
    storyOpen = false;
    forensicCatalog = buildForensicSeries(selectedCase.timeline);
    const available = new Set(forensicCatalog.map((s) => s.id));
    forensicEnabledIds = forensicEnabledIds.filter((id) => available.has(id));
    if (forensicEnabledIds.length === 0) forensicEnabledIds = defaultForensicSeriesIds(forensicCatalog);
    chartOpen = true;
    await tick();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await renderForensicChart();
  }

  function resetForensicSeries() {
    const available = new Set(forensicCatalog.map((s) => s.id));
    forensicEnabledIds = defaultForensicSeriesIds(forensicCatalog);
    void renderForensicChart();
  }

  function clearForensicSeries() {
    forensicEnabledIds = [];
    void renderForensicChart();
  }

  function setForensicGroup(ids: string[], on: boolean) {
    const next = new Set(forensicEnabledIds);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    forensicEnabledIds = [...next];
    void renderForensicChart();
  }

  function formatForensicTick(scale: ForensicSeriesDef['scale'], value: number): string {
    if (scale === 'pct') return `${value.toFixed(1)}%`;
    if (scale === 'units') return formatUnits(value);
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
    return money(value);
  }

  async function renderForensicChart() {
    const token = ++forensicRender;
    if (!chartOpen || !selectedCase) return;
    const Chart = await loadChartJs();
    if (token !== forensicRender || !chartOpen || !forensicCanvas?.isConnected || !selectedCase) return;

    const enabled = new Set(forensicEnabledIds);
    const series = forensicCatalog.filter((s) => enabled.has(s.id));
    const styles = styleEnabledSeries(forensicEnabledIds);
    forensicChart?.destroy();
    forensicChart = null;
    if (series.length === 0) return;

    const isDark = document.documentElement.classList.contains('dark');
    const tickColor = isDark ? '#94a3b8' : '#64748b';
    const grid = isDark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.15)';
    const timeline = selectedCase.timeline;
    const hasUsd = series.some((s) => s.scale === 'usd');
    const hasPct = series.some((s) => s.scale === 'pct');
    const hasUnits = series.some((s) => s.scale === 'units');
    const scaleByAxis: Record<string, ForensicSeriesDef['scale']> = {
      yUsd: 'usd',
      yPct: 'pct',
      yUnits: 'units',
    };

    forensicChart = new Chart(forensicCanvas, {
      type: 'line',
      data: {
        labels: timeline.map((t) => String(t.age)),
        datasets: series.map((s) => {
          const style = styles[s.id] ?? { color: s.color, pointStyle: 'circle' };
          return {
            label:
              s.group === 'Cash flow' ||
              s.group === 'Spending' ||
              s.group === 'Returns' ||
              s.group === 'Return contribution'
                ? s.label
                : `${s.group} · ${s.label}`,
            data: timeline.map((t) => s.value(t)),
            borderColor: style.color,
            backgroundColor: style.color,
            fill: false,
            borderWidth: 2,
            borderDash: s.dashed ? [6, 4] : undefined,
            pointStyle: style.pointStyle,
            pointRadius: 4,
            pointHoverRadius: 8,
            pointHitRadius: 12,
            pointBorderWidth: 1.5,
            pointBorderColor: style.color,
            hoverBorderWidth: 4,
            spanGaps: true,
            tension: 0.15,
            yAxisID: axisIdForScale(s.scale),
          };
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', axis: 'xy', intersect: false },
        plugins: {
          legend: {
            labels: {
              color: tickColor,
              boxWidth: 12,
              font: { size: 11 },
              usePointStyle: true,
            },
          },
          tooltip: {
            mode: 'nearest',
            intersect: false,
            displayColors: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            filter(_item: any, index: number) {
              return index === 0;
            },
            callbacks: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              title(items: any[]) {
                const i = items[0]?.dataIndex ?? 0;
                const year = timeline[i];
                if (!year) return '';
                return `Age ${year.age} · ${year.calendarYear}`;
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              label(ctx: any) {
                const axis = ctx.dataset.yAxisID as string;
                const scale = scaleByAxis[axis] ?? 'usd';
                const v = ctx.parsed.y;
                if (v == null || !Number.isFinite(v)) return `${ctx.dataset.label}: —`;
                return `${ctx.dataset.label}: ${formatForensicTick(scale, v)}`;
              },
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: 'Age', color: tickColor },
            ticks: { color: tickColor, maxTicksLimit: 18 },
            grid: { color: grid },
          },
          yUsd: {
            display: hasUsd,
            position: 'left',
            title: { display: hasUsd, text: 'USD', color: tickColor },
            ticks: {
              color: tickColor,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              callback: (v: any) => formatForensicTick('usd', Number(v)),
            },
            grid: { color: grid },
          },
          yPct: {
            display: hasPct,
            position: 'right',
            title: { display: hasPct, text: '%', color: tickColor },
            ticks: {
              color: tickColor,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              callback: (v: any) => `${Number(v).toFixed(0)}%`,
            },
            grid: { drawOnChartArea: !hasUsd },
          },
          yUnits: {
            display: hasUnits,
            position: 'right',
            offset: hasPct && hasUnits,
            title: { display: hasUnits, text: 'Units', color: tickColor },
            ticks: {
              color: tickColor,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              callback: (v: any) => formatUnits(Number(v)),
            },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });
  }

  function snapshotRows(rows: AccountYearSnapshot[] | undefined): AccountYearSnapshot[] {
    return rows ?? [];
  }

  onMount(() => {
    // no auto-run — user clicks Run
  });
</script>

<PlannerPanel
  title="Monte Carlo"
  description="Thousands of randomized return paths. Browse failure cases, typical middle outcomes, and upper-tail moonshots."
>
  <svelte:fragment slot="actions">
    <div class="mt-3 flex flex-wrap gap-2">
      {#if running}
        <button type="button" class="btn-secondary" on:click={stopRun}>Cancel</button>
      {:else}
        <button type="button" class="btn-primary" on:click={openConfirm} disabled={!planReady}>
          Run simulation
        </button>
        <button type="button" class="btn-secondary" on:click={startGrid} disabled={!planReady}>
          Run grid
        </button>
      {/if}
    </div>
  </svelte:fragment>

  {#if !planReady}
    <EmptyState
      title="Complete your plan first"
      message="Monte Carlo needs account balances and spending assumptions. Fill in Assets and Income & Expenses, then return here."
    />
  {:else}
  <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-600 dark:text-gray-400 flex flex-wrap gap-x-6 gap-y-2">
    <span>
      Runs:
      <strong class="text-gray-900 dark:text-white">{$planStore.assumptions.monteCarloRuns}</strong>
      <span class="text-xs text-gray-500">(change in Assumptions)</span>
    </span>
    <span>
      Target success:
      <strong class="text-gray-900 dark:text-white"
        >{($planStore.assumptions.successThreshold * 100).toFixed(0)}%</strong
      >
    </span>
    <span>
      Equity vol:
      <strong class="text-gray-900 dark:text-white"
        >{($planStore.assumptions.equityVolatility * 100).toFixed(0)}%</strong
      >
    </span>
    <span>
      Crypto vol:
      <strong class="text-gray-900 dark:text-white"
        >{($planStore.assumptions.cryptoVolatility * 100).toFixed(0)}%</strong
      >
    </span>
    {#if $planStore.assumptions.marketCycle}
      <span>
        Recession odds:
        <strong class="text-gray-900 dark:text-white"
          >{($planStore.assumptions.marketCycle.recessionProbability * 100).toFixed(0)}%/yr</strong
        >
      </span>
      <span>
        Boom odds:
        <strong class="text-gray-900 dark:text-white"
          >{($planStore.assumptions.marketCycle.boomProbability * 100).toFixed(0)}%/yr</strong
        >
        <span class="text-xs text-gray-500">(change in Assumptions)</span>
      </span>
    {/if}
  </div>

  {#if gridCollapsed && hasGridResults}
    <div
      class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 px-4 py-3"
    >
      <p class="text-sm text-gray-600 dark:text-gray-400">
        Scenario grid results are hidden while you inspect this simulation.
      </p>
      <button type="button" class="btn-secondary btn-compact" on:click={() => (gridCollapsed = false)}>
        Show grid results ({gridDoneCount} of {GRID_CELL_COUNT})
      </button>
    </div>
  {/if}

  {#if displayGrid && !gridCollapsed}
    <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <div>
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Scenario grid</h3>
        <p class="mt-1 text-xs text-gray-500">
          Lock one dimension. The other two become a {GRID_CELL_COUNT}-cell Monte Carlo
          ({displayGrid.rows.length}×{displayGrid.cols.length} × {$planStore.assumptions.monteCarloRuns.toLocaleString()} paths,
          same random seed). Cells fill in as each run finishes. Sky highlighting marks the plan’s
          target retirement age and current spend.
        </p>
      </div>
      <fieldset class="space-y-2" disabled={running}>
        <legend class="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Inelastic (locked) dimension
        </legend>
        <div class="flex flex-wrap gap-2">
          <label class="inline-flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm">
            <input
              type="radio"
              name="grid-inelastic"
              checked={gridInelastic === 'bitcoin'}
              on:change={() => setGridInelastic('bitcoin')}
            />
            Bitcoin today
          </label>
          <label class="inline-flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm">
            <input
              type="radio"
              name="grid-inelastic"
              checked={gridInelastic === 'retirementAge'}
              on:change={() => setGridInelastic('retirementAge')}
            />
            Retirement age
          </label>
          <label class="inline-flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm">
            <input
              type="radio"
              name="grid-inelastic"
              checked={gridInelastic === 'spend'}
              on:change={() => setGridInelastic('spend')}
            />
            Starting spend
          </label>
        </div>
      </fieldset>
      {#if gridInelastic === 'bitcoin'}
        <label class="block text-sm" class:opacity-60={running}>
          <span class="text-xs font-semibold uppercase tracking-wide text-gray-500">Locked Bitcoin choice</span>
          <select
            class="mt-1 w-full max-w-md rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
            bind:value={gridLockedBitcoinId}
            disabled={running}
            on:change={() => {
              if (!running) {
                gridSpec = null;
                gridCells = [];
              }
            }}
          >
            {#each BITCOIN_GRID_CHOICES as choice}
              <option value={choice.id}>{choice.label}</option>
            {/each}
          </select>
        </label>
      {/if}
      <p
        class="text-xs text-gray-500 {displayGrid.locked.spendLines?.length ? 'cursor-help' : ''}"
        on:mouseenter={(e) =>
          displayGrid.locked.spendLines?.length &&
          openSpendTip(
            e,
            displayGrid.locked.label,
            displayGrid.locked.spendLines,
            displayGrid.locked.spendTotal
          )}
        on:mousemove={moveSpendTip}
        on:mouseleave={closeSpendTip}
      >
        Locked: {displayGrid.locked.label}. Rows: {displayGrid.rowAxis === 'retirementAge'
          ? 'retirement age'
          : displayGrid.rowAxis === 'spend'
            ? 'starting spend'
            : 'Bitcoin today'}. Columns: {displayGrid.colAxis === 'retirementAge'
          ? 'retirement age'
          : displayGrid.colAxis === 'spend'
            ? 'starting spend'
            : 'Bitcoin today'}.
        {#if bitcoinHoldings.usd <= 0}
          No Bitcoin holdings — sell-today rows will match keep.
        {/if}
      </p>
      <div class="overflow-x-auto">
        {#key gridCells.map((cell) => `${cell.status}:${cell.successRate ?? ''}`).join('|')}
        <table class="min-w-full border-collapse text-xs">
          <thead>
            <tr>
              <th class="sticky left-0 z-10 bg-white dark:bg-gray-900 px-2 py-1.5 text-left font-medium text-gray-500 border-b border-gray-200 dark:border-gray-700">
                {displayGrid.rowAxis === 'retirementAge'
                  ? 'Age'
                  : displayGrid.rowAxis === 'spend'
                    ? 'Spend'
                    : 'Bitcoin'}
              </th>
              {#each displayGrid.cols as col}
                <th
                  class="{baselineHeaderClass(!!col.isDefault, false, displayGrid.colAxis === 'bitcoin')} {col.spendLines
                    ?.length
                    ? 'cursor-help'
                    : ''}"
                  title={col.spendLines?.length ? undefined : col.label}
                  on:mouseenter={(e) =>
                    col.spendLines?.length &&
                    openSpendTip(e, col.label, col.spendLines, col.spendTotal)}
                  on:mousemove={moveSpendTip}
                  on:mouseleave={closeSpendTip}
                >
                  <span class="block">{col.shortLabel}</span>
                  {#if col.isDefault}
                    <span class="block text-[9px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                      {baselineCaption(displayGrid.colAxis)}
                    </span>
                  {/if}
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each displayGrid.rows as row, r}
              <tr class={row.isDefault ? 'bg-sky-50/80 dark:bg-sky-950/30' : ''}>
                <th
                  class="{baselineHeaderClass(!!row.isDefault, true, displayGrid.rowAxis === 'bitcoin')} {row.spendLines?.length
                    ? 'cursor-help'
                    : ''}"
                  title={row.spendLines?.length ? undefined : row.label}
                  on:mouseenter={(e) =>
                    row.spendLines?.length &&
                    openSpendTip(e, row.label, row.spendLines, row.spendTotal)}
                  on:mousemove={moveSpendTip}
                  on:mouseleave={closeSpendTip}
                >
                  <span class="block">{row.shortLabel}</span>
                  {#if row.isDefault}
                    <span class="block text-[9px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                      {baselineCaption(displayGrid.rowAxis)}
                    </span>
                  {/if}
                </th>
                {#each displayGrid.cols as col, c}
                  {@const cell = gridCellByKey.get(`${r}:${c}`)}
                  {@const isBest = gridBestKey === `${r}:${c}`}
                  {@const spendAxis = spendAxisOf(row, col)}
                  {@const isBaselineCross = !!(row.isDefault && col.isDefault)}
                  <td
                    class="border-b border-gray-100 dark:border-gray-800 p-0.5 {col.isDefault &&
                    !row.isDefault
                      ? 'bg-sky-50/80 dark:bg-sky-950/30'
                      : ''} {spendAxis?.spendLines?.length || cell?.status === 'done'
                      ? 'cursor-help'
                      : ''}"
                    title={spendAxis?.spendLines?.length
                      ? undefined
                      : `${row.label} · ${col.label}`}
                    on:mouseenter={(e) => {
                      const stats =
                        cell?.status === 'done'
                          ? {
                              successRate: cell.successRate ?? 0,
                              p25: cell.p25Ending ?? 0,
                              p50: cell.medianEnding ?? 0,
                              p75: cell.p75Ending ?? 0,
                              mean: cell.meanEnding ?? 0,
                              stdev: cell.stdevEnding ?? 0,
                            }
                          : undefined;
                      if (spendAxis?.spendLines?.length || stats) {
                        openSpendTip(
                          e,
                          `${row.label} · ${col.label}`,
                          spendAxis?.spendLines,
                          spendAxis?.spendTotal,
                          stats
                        );
                      }
                    }}
                    on:mousemove={moveSpendTip}
                    on:mouseleave={closeSpendTip}
                  >
                    <div
                      class="min-h-[3.25rem] min-w-[4.5rem] rounded-md px-1.5 py-1 text-center {isBest
                        ? 'ring-2 ring-emerald-500'
                        : isBaselineCross
                          ? 'ring-1 ring-sky-400 dark:ring-sky-500'
                          : ''}"
                      style="background: {gridCellFill(cell)}"
                    >
                      {#if cell?.status === 'running'}
                        <span class="text-[10px] uppercase tracking-wide text-amber-800 dark:text-amber-200">Running</span>
                      {:else if cell?.status === 'done'}
                        <span class="block text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                          {pct(cell.successRate ?? 0)}
                        </span>
                        <span class="block text-[10px] tabular-nums text-gray-600 dark:text-gray-400">
                          {money(cell.p25Ending ?? 0)}–{money(cell.p75Ending ?? 0)}
                        </span>
                      {:else if cell?.status === 'error'}
                        <span class="text-[10px] text-red-600 dark:text-red-400">Error</span>
                      {:else}
                        <span class="text-[10px] text-gray-400">—</span>
                      {/if}
                    </div>
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
        {/key}
      </div>
      {#if gridDoneCount > 0}
        <p class="text-[11px] text-gray-500">
          Success rate (top) and 25th–75th percentile ending (bottom). Hover a cell for median, mean, and standard deviation. Deep green is 90%+, teal is 80–90%, orange is under 80%, red is under 70%. Sky marks the plan’s target age and current spend. Ring marks the best finished cell.
          {gridDoneCount} of {GRID_CELL_COUNT} complete.
        </p>
      {/if}
    </div>
  {/if}

  {#if running}
    <div class="space-y-2">
      <div class="flex justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>
          {#if runKind === 'grid'}
            Grid {Math.min(GRID_CELL_COUNT, gridDoneCount + 1)} of {GRID_CELL_COUNT} cells
          {:else}
            Simulating paths…
          {/if}
        </span>
        <span>{progress.toLocaleString()} / {progressTotal.toLocaleString()}</span>
      </div>
      <div class="h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
        <div
          class="h-full bg-primary-600 transition-all duration-150"
          style="width: {progressTotal ? (100 * progress) / progressTotal : 0}%"
        ></div>
      </div>
    </div>
  {/if}

  {#if error}
    <p class="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
  {/if}

  {#if result}
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div
        class="rounded-lg border p-4 {result.meetsThreshold
          ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
          : 'border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20'}"
      >
        <p class="text-xs uppercase tracking-wide text-gray-500">Success rate</p>
        <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
          {pct(result.successRate)}
        </p>
        <p class="text-xs mt-1 text-gray-500">
          {result.successCount.toLocaleString()} of {result.runs.toLocaleString()} paths funded
          {result.meetsThreshold ? '· meets target' : '· below target'}
        </p>
      </div>
      <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <p class="text-xs uppercase tracking-wide text-gray-500">Failed paths</p>
        <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
          {result.failureCount.toLocaleString()}
        </p>
        <p class="text-xs mt-1 text-gray-500">
          Showing {result.failureCases.length} detailed worst outcomes
        </p>
      </div>
      <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <p class="text-xs uppercase tracking-wide text-gray-500">Median ending</p>
        <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
          {money(
            [...result.endingBalances].sort((a, b) => a - b)[
              Math.floor(result.endingBalances.length * 0.5)
            ] ?? 0
          )}
        </p>
        <p class="text-xs mt-1 text-gray-500">50th percentile terminal balance</p>
      </div>
      <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <p class="text-xs uppercase tracking-wide text-gray-500">10th pct ending</p>
        <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
          {money(
            [...result.endingBalances].sort((a, b) => a - b)[
              Math.floor(result.endingBalances.length * 0.1)
            ] ?? 0
          )}
        </p>
        <p class="text-xs mt-1 text-gray-500">Lower-tail outcome</p>
      </div>
    </div>

    {#if result.simulationMeta}
      <p class="text-xs text-gray-500 dark:text-gray-400">
        Reproducibility: engine {result.simulationMeta.engineVersion}, seed {result.simulationMeta.seed},
        tax {result.simulationMeta.taxLawPackId}
      </p>
    {/if}

    {#if result.sequenceRisk}
      <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-sm">
        <p class="text-xs uppercase tracking-wide text-gray-500 mb-2">Sequence risk (sampled paths)</p>
        <p class="text-gray-700 dark:text-gray-300">
          Early-retirement cumulative return (mean): {(result.sequenceRisk.meanEarlyRetirementCumulative * 100).toFixed(1)}%
          · forced risk-asset sales: {(result.sequenceRisk.forcedSaleYearRate * 100).toFixed(1)}% of retired years
          · runway stress years: {(result.sequenceRisk.runwayExhaustionRate * 100).toFixed(1)}%
          · paths with shortfall: {(result.sequenceRisk.shortfallPathRate * 100).toFixed(1)}%
        </p>
      </div>
    {/if}

    {#if policyComparison}
      <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-sm">
        <p class="text-xs uppercase tracking-wide text-gray-500 mb-2">
          Policy comparison (seed {policyComparison.seed})
        </p>
        <p class="text-gray-700 dark:text-gray-300">
          {policyComparison.baseline.label} ending {money(policyComparison.baseline.result.endingBalance)}
          vs {policyComparison.variant.label} {money(policyComparison.variant.result.endingBalance)}
          (Δ {money(policyComparison.deltas.endingBalance)}).
          Roth converted: {money(policyComparison.deltas.totalRothConverted)} difference.
        </p>
      </div>
    {/if}

    <p class="text-xs text-gray-500 dark:text-gray-400">
      Simulated market mix across all paths: {(result.observedRecessionShare * 100).toFixed(1)}% recession
      years, {(result.observedBoomShare * 100).toFixed(1)}% boom years (persistence makes recessions cluster
      into multi-year bear markets).
    </p>

    <div>
      <h3 class="font-medium text-gray-900 dark:text-white mb-2">Portfolio fan (10th / 50th / 90th)</h3>
      <div
        class="h-[300px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-3"
      >
        <canvas bind:this={fanCanvas}></canvas>
      </div>
    </div>

    <div>
      <h3 class="font-medium text-gray-900 dark:text-white mb-2">Ending balance distribution</h3>
      <div
        class="h-[220px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-3"
      >
        <canvas bind:this={histCanvas}></canvas>
      </div>
      <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
        Buckets double in width ($0–$1M, $1–$2M, $2–$4M, …) so typical outcomes stay visible. Red
        <span class="font-medium">$0</span> = depleted; amber
        <span class="font-medium">≥ …</span> = right-tail outliers above the last ladder edge.
      </p>
    </div>

    <div class="space-y-4">
      <div>
        <h3 class="font-medium text-gray-900 dark:text-white">Scenario browser</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Inspect illustrative paths: worst outcomes (including lower-tail successes), middle-of-the-pack
          results, and upper-tail moonshots. Fixed-return Bitcoin uses your mean and volatility; other Bitcoin models and crypto use a halving-cycle simulation.
          The first projection year only applies the remaining fraction of this calendar year to today’s prices — it does not replay a full January–December return.
          Narratives are reconstructions from simulated returns — not forecasts.
        </p>
      </div>

      <div
        class="flex flex-wrap gap-1 p-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          aria-selected={scenarioTab === 'failures'}
          class="px-3 py-1.5 rounded-md text-sm transition-colors {scenarioTab === 'failures'
            ? 'bg-white dark:bg-gray-800 text-red-700 dark:text-red-300 shadow-sm font-medium'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}"
          on:click={() => setScenarioTab('failures')}
        >
          Worst outcomes
          <span class="opacity-70">({result.failureCases.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={scenarioTab === 'average'}
          class="px-3 py-1.5 rounded-md text-sm transition-colors {scenarioTab === 'average'
            ? 'bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 shadow-sm font-medium'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}"
          on:click={() => setScenarioTab('average')}
        >
          Average Expectations
          <span class="opacity-70">({(result.averageCases ?? []).length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={scenarioTab === 'moonshots'}
          class="px-3 py-1.5 rounded-md text-sm transition-colors {scenarioTab === 'moonshots'
            ? 'bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-300 shadow-sm font-medium'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}"
          on:click={() => setScenarioTab('moonshots')}
        >
          Moonshots
          <span class="opacity-70">({(result.moonshotCases ?? []).length})</span>
        </button>
      </div>

      {#if scenarioTab === 'failures'}
        <p class="text-sm text-gray-600 dark:text-gray-400">
          The weakest paths in this batch — failed plans and still-funded lower-tail outcomes — showing
          sequence risk, drawdowns, and Bitcoin/crypto bear years.
        </p>
      {:else if scenarioTab === 'average'}
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Ten successful paths whose ending balances sit closest to the simulation median — a realistic
          “middle of the pack” picture.
        </p>
      {:else}
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Top ten successful paths by ending balance — upper-tail luck, not a planning target.
        </p>
      {/if}

      {#if activeCases.length === 0}
        {#if scenarioTab === 'failures'}
          <p
            class="text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2 text-gray-700 dark:text-gray-300"
          >
            No paths were captured for this run — try running again with more simulations.
          </p>
        {:else}
          <p
            class="text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2 text-gray-700 dark:text-gray-300"
          >
            No successful paths in this category for this run.
          </p>
        {/if}
      {:else}
        <div class="flex flex-wrap gap-2">
          {#each activeCases as f, i}
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg text-sm border transition-colors {selectedCase === f
                ? caseAccent().btn
                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}"
              on:click={() => selectCase(f)}
            >
              Case {i + 1}
              <span class="text-xs opacity-70">
                {#if scenarioTab === 'failures'}
                  · age {f.depletedAge ?? f.firstShortfallAge ?? '—'}
                {:else}
                  · {money(f.endingBalance)}
                {/if}
              </span>
            </button>
          {/each}
        </div>

        {#if selectedCase}
          <div class="grid gap-4 lg:grid-cols-2">
            <div class="rounded-lg border p-4 space-y-3 {caseAccent().panel}">
              <div class="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                <span>Run #{selectedCase.runIndex}</span>
                <span>End {money(selectedCase.endingBalance)}</span>
                <span>Peak {money(selectedCase.peakPortfolio)} @ {selectedCase.peakAge}</span>
                <span>Drawdown {(selectedCase.maxDrawdownPct * 100).toFixed(0)}%</span>
                <span
                  >Early retirement cum. {(selectedCase.earlyRetirementCumulative * 100).toFixed(
                    1
                  )}%</span
                >
                <div class="ml-auto flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    class="btn-secondary btn-compact"
                    on:click={openScenarioCharts}
                  >
                    View Charts
                  </button>
                  <button
                    type="button"
                    class="btn-secondary btn-compact"
                    on:click={openScenarioJson}
                  >
                    View JSON
                  </button>
                  <button
                    type="button"
                    class="btn-secondary btn-compact"
                    on:click={openScenarioStory}
                  >
                    View Story
                  </button>
                </div>
              </div>
              <ol class="list-decimal list-inside space-y-2 text-sm text-gray-800 dark:text-gray-200">
                {#each selectedCase.circumstances as line}
                  <li>{line}</li>
                {/each}
              </ol>
            </div>
            <div
              class="h-[260px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-3"
            >
              <canvas bind:this={caseCanvas}></canvas>
            </div>
          </div>

          <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 max-h-[32rem] overflow-y-auto">
            <table class="min-w-full text-xs">
              <thead
                class="sticky top-0 bg-gray-50 dark:bg-gray-800 text-left text-gray-600 dark:text-gray-400 z-10"
              >
                <tr>
                  <th class="px-2 py-1.5 font-medium w-8"></th>
                  <th class="px-2 py-1.5 font-medium">Age</th>
                  <th class="px-2 py-1.5 font-medium">Year</th>
                  <th class="px-2 py-1.5 font-medium">Portfolio</th>
                  <th class="px-2 py-1.5 font-medium">Return</th>
                  <th class="px-2 py-1.5 font-medium" title="Equity-like accounts (IRA / Roth / brokerage)">
                    Market
                  </th>
                  <th class="px-2 py-1.5 font-medium">Bitcoin</th>
                  <th class="px-2 py-1.5 font-medium">Crypto</th>
                  <th class="px-2 py-1.5 font-medium">Gold</th>
                  <th class="px-2 py-1.5 font-medium">Silver</th>
                  <th class="px-2 py-1.5 font-medium">Withdraw</th>
                  <th class="px-2 py-1.5 font-medium">General</th>
                  <th class="px-2 py-1.5 font-medium">Travel</th>
                  <th class="px-2 py-1.5 font-medium">Health</th>
                  <th class="px-2 py-1.5 font-medium">Spend</th>
                  <th class="px-2 py-1.5 font-medium">Inc+SS</th>
                  <th class="px-2 py-1.5 font-medium">Shortfall</th>
                </tr>
              </thead>
              <tbody>
                {#each selectedCase.timeline as t}
                  {@const spend = yearSpend(t)}
                  <tr
                    class="border-t border-gray-200 dark:border-gray-700 {t.shortfall > 0
                      ? 'bg-red-50/80 dark:bg-red-950/30'
                      : t.portfolioReturn < -0.1
                        ? 'bg-amber-50/50 dark:bg-amber-950/20'
                        : t.portfolioReturn > 0.2
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20'
                          : ''}"
                  >
                    <td class="px-1 py-1">
                      <button
                        type="button"
                        class="rounded px-1.5 py-0.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                        aria-expanded={expandedAge === t.age}
                        aria-label={expandedAge === t.age
                          ? `Hide account balances for age ${t.age}`
                          : `Show account balances for age ${t.age}`}
                        on:click={() => toggleYear(t.age)}
                      >
                        {expandedAge === t.age ? '▾' : '▸'}
                      </button>
                    </td>
                    <td class="px-2 py-1 whitespace-nowrap">
                      {t.age}{#if t.downYear}<span class="ml-1 text-[10px] text-amber-700 dark:text-amber-300">down</span>{/if}
                    </td>
                    <td class="px-2 py-1">{t.calendarYear ?? '—'}</td>
                    <td class="px-2 py-1">{money(t.portfolio)}</td>
                    <td
                      class="px-2 py-1 font-medium {t.portfolioReturn < 0
                        ? 'text-red-600 dark:text-red-400'
                        : t.portfolioReturn > 0.2
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : ''}"
                    >
                      {(t.portfolioReturn * 100).toFixed(1)}%
                    </td>
                    <td class="px-2 py-1 whitespace-nowrap {sleeveClass(t.marketReturn)}">
                      {sleeveLabel(t.marketReturn, t.marketContribution)}
                    </td>
                    <td class="px-2 py-1 whitespace-nowrap {sleeveClass(t.bitcoinReturn)}">
                      {sleeveLabel(t.bitcoinReturn, t.bitcoinContribution)}
                    </td>
                    <td class="px-2 py-1 whitespace-nowrap {sleeveClass(t.cryptoReturn)}">
                      {sleeveLabel(t.cryptoReturn, t.cryptoContribution)}
                    </td>
                    <td class="px-2 py-1 whitespace-nowrap {sleeveClass(t.goldReturn)}">
                      {sleeveLabel(t.goldReturn, t.goldContribution)}
                    </td>
                    <td class="px-2 py-1 whitespace-nowrap {sleeveClass(t.silverReturn)}">
                      {sleeveLabel(t.silverReturn, t.silverContribution)}
                    </td>
                    <td class="px-2 py-1">{money(t.withdrawal)}</td>
                    <td class="px-2 py-1">{money(spend.general)}</td>
                    <td class="px-2 py-1">{money(spend.travel)}</td>
                    <td class="px-2 py-1">{money(spend.healthInsurance)}</td>
                    <td class="px-2 py-1">{money(spend.total)}</td>
                    <td class="px-2 py-1">{money(t.incomePlusSs)}</td>
                    <td class="px-2 py-1">{t.shortfall > 0 ? money(t.shortfall) : '—'}</td>
                  </tr>
                  {#if expandedAge === t.age}
                    <tr class="border-t border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/60">
                      <td colspan="17" class="px-3 py-3 space-y-3">
                        <div class="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-600 dark:text-gray-400">
                          <span>Contributions {money(t.contributions ?? 0)}</span>
                          <span>RMD {money(t.rmd ?? 0)}</span>
                          <span>Roth conversion {money(t.rothConversion ?? 0)}</span>
                          <span>Est. tax {money(t.estimatedTax ?? 0)}</span>
                          {#if (t.expenseCut ?? 0) > 0}
                            <span>Expense cut {money(t.expenseCut)}</span>
                          {/if}
                        </div>
                        <div class="grid gap-3 lg:grid-cols-2">
                          <div>
                            <p class="mb-1 font-medium text-gray-700 dark:text-gray-300">
                              Start of year
                              <span class="font-normal text-gray-500"> (before contributions &amp; returns)</span>
                            </p>
                            {#if snapshotRows(t.accountsStart).length === 0}
                              <p class="text-gray-500">No opening snapshots — re-run Monte Carlo.</p>
                            {:else}
                              <table class="w-full text-[11px]">
                                <thead class="text-gray-500">
                                  <tr>
                                    <th class="py-1 pr-2 font-medium text-left">Account</th>
                                    <th class="py-1 pr-2 font-medium text-left">Owner</th>
                                    <th class="py-1 pr-2 font-medium text-right">Units</th>
                                    <th class="py-1 pr-2 font-medium text-right">Price</th>
                                    <th class="py-1 font-medium text-right">USD</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {#each snapshotRows(t.accountsStart) as acct}
                                    <tr class="border-t border-gray-200/80 dark:border-gray-700/80">
                                      <td class="py-0.5 pr-2">{acct.label}</td>
                                      <td class="py-0.5 pr-2">{ownerLabel(acct.owner)}</td>
                                      <td class="py-0.5 pr-2 text-right tabular-nums">{formatUnits(acct.units)}</td>
                                      <td class="py-0.5 pr-2 text-right tabular-nums">{formatPrice(acct.priceUsd)}</td>
                                      <td class="py-0.5 text-right tabular-nums">{money(acct.balanceUsd)}</td>
                                    </tr>
                                  {/each}
                                </tbody>
                              </table>
                            {/if}
                          </div>
                          <div>
                            <p class="mb-1 font-medium text-gray-700 dark:text-gray-300">
                              End of year
                              <span class="font-normal text-gray-500"> (after growth, withdrawals, tax)</span>
                            </p>
                            {#if snapshotRows(t.accountsEnd).length === 0}
                              <p class="text-gray-500">No closing snapshots — re-run Monte Carlo.</p>
                            {:else}
                              <table class="w-full text-[11px]">
                                <thead class="text-gray-500">
                                  <tr>
                                    <th class="py-1 pr-2 font-medium text-left">Account</th>
                                    <th class="py-1 pr-2 font-medium text-left">Owner</th>
                                    <th class="py-1 pr-2 font-medium text-right">Units</th>
                                    <th class="py-1 pr-2 font-medium text-right">Price</th>
                                    <th class="py-1 pr-2 font-medium text-right">USD</th>
                                    <th class="py-1 font-medium text-right">Mkt</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {#each snapshotRows(t.accountsEnd) as acct}
                                    <tr class="border-t border-gray-200/80 dark:border-gray-700/80">
                                      <td class="py-0.5 pr-2">{acct.label}</td>
                                      <td class="py-0.5 pr-2">{ownerLabel(acct.owner)}</td>
                                      <td class="py-0.5 pr-2 text-right tabular-nums">{formatUnits(acct.units)}</td>
                                      <td class="py-0.5 pr-2 text-right tabular-nums">{formatPrice(acct.priceUsd)}</td>
                                      <td class="py-0.5 pr-2 text-right tabular-nums">{money(acct.balanceUsd)}</td>
                                      <td class="py-0.5 text-right tabular-nums {sleeveClass(acct.marketReturn)}">
                                        {acct.marketReturn == null ? '—' : pct(acct.marketReturn)}
                                      </td>
                                    </tr>
                                  {/each}
                                </tbody>
                              </table>
                            {/if}
                          </div>
                        </div>
                      </td>
                    </tr>
                  {/if}
                {/each}
              </tbody>
            </table>
            <p class="px-2 py-1.5 text-[11px] text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
              Expand a year for opening and closing account balances (units, price, dollars) plus contributions, RMDs, conversions, and tax.
              Sleeve columns show that asset’s return and its contribution to the portfolio return in
              percentage points (weight × return). Bonds/cash are included in portfolio return but not
              broken out here. Health includes plan health-insurance expenses plus the Medicare-gap premium.
            </p>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
  {/if}
</PlannerPanel>

{#if confirmOpen}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
    role="presentation"
    on:click|self={closeConfirm}
    on:keydown={(e) => e.key === 'Escape' && closeConfirm()}
  >
    <div
      class="max-h-[90dvh] overflow-y-auto w-full max-w-xl rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl"
      use:dialogFocus={closeConfirm}
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mc-confirm-title"
    >
      <div class="border-b border-gray-100 dark:border-gray-800 px-5 py-4">
        <h3 id="mc-confirm-title" class="text-lg font-semibold text-gray-900 dark:text-white">
          Confirm simulation inputs
        </h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Quick check before running {$planStore.assumptions.monteCarloRuns.toLocaleString()} paths.
        </p>
      </div>

      <div class="px-5 py-4 space-y-4 text-sm">
        <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-1">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Salary before retirement
          </p>
          {#if salarySummary.annual <= 0 || salarySummary.years <= 0}
            <p class="text-gray-700 dark:text-gray-300">
              No primary earned income modeled between now and retirement age
              {$planStore.primary.retirementAge}.
            </p>
          {:else}
            <p class="text-gray-900 dark:text-white font-medium">
              {money(salarySummary.annual)}/yr × {salarySummary.years.toFixed(1)} year{Math.abs(salarySummary.years - 1) < 0.05
                ? ''
                : 's'} remaining
              ≈ {money(salarySummary.totalNominal)} total (today’s dollars, not inflated)
            </p>
            <p class="text-xs text-gray-500">
              From today through {salarySummary.birthMonthLabel}
              {salarySummary.retireYear} at retirement age
              {$planStore.primary.retirementAge}
              {#if salarySummary.asOfYear < salarySummary.retireYear}
                · leftover {salarySummary.asOfYear} plus a partial {salarySummary.retireYear}
              {:else}
                · leftover {salarySummary.asOfYear} only
              {/if}
              {#if salarySummary.labels.length}
                · {salarySummary.labels.join(', ')}
              {/if}
            </p>
          {/if}
        </div>

        <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-1">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Yearly expenses at start
          </p>
          {#if startSpend.total <= 0 && !startSpend.lines.some((l) => l.amount > 0)}
            <p class="text-gray-700 dark:text-gray-300">
              No spending modeled at age {$planStore.primary.currentAge}.
            </p>
          {:else}
            <p class="text-gray-900 dark:text-white font-medium">
              {money(startSpend.total)}/yr at age {$planStore.primary.currentAge} (today’s dollars)
            </p>
            {#if startSpend.lines.length}
              <ul class="mt-1 space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
                {#each startSpend.lines.filter((l) => l.amount > 0 && !l.upcoming) as line}
                  <li class="flex justify-between gap-3">
                    <span>{line.label}</span>
                    <span class="tabular-nums shrink-0">{money(line.amount)}</span>
                  </li>
                {/each}
                {#if startSpend.housing > 0 && startSpend.lines.filter((l) => l.kind === 'housing').length > 1}
                  <li class="flex justify-between gap-3 font-medium text-gray-700 dark:text-gray-300">
                    <span>Housing total</span>
                    <span class="tabular-nums shrink-0">{money(startSpend.housing)}</span>
                  </li>
                {/if}
                {#if startSpend.lines.some((l) => l.upcoming && l.amount > 0)}
                  <li class="pt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Charged later (today’s dollars, inflates in the projection)
                  </li>
                  {#each startSpend.lines.filter((l) => l.upcoming && l.amount > 0) as line}
                    <li class="flex justify-between gap-3">
                      <span>{line.label}</span>
                      <span class="tabular-nums shrink-0">{money(line.amount)}</span>
                    </li>
                  {/each}
                {/if}
              </ul>
            {/if}
            <p class="text-xs text-gray-500">
              {#if startSpend.usingWithdrawalRate}
                {($planStore.assumptions.withdrawalRate * 100).toFixed(1)}% withdrawal rate on the starting portfolio
                {#if $planStore.primary.currentAge < $planStore.primary.retirementAge}
                  (applies once retired)
                {/if}
              {:else}
                Plan expenses active at the current age
                {#if $planStore.expenses.some((e) => e.retirementAnnualAmount != null)}
                  · retirement amounts apply from age {$planStore.primary.retirementAge}
                {/if}
              {/if}
            </p>
          {/if}
        </div>

        <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Social Security at claim
          </p>
          {#each ssSummaries as ss}
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <span class="text-gray-700 dark:text-gray-300">{ss.name}</span>
              {#if ss.monthly != null && ss.monthly > 0}
                <span class="text-gray-900 dark:text-white font-medium">
                  {money(ss.monthly, 2)}/mo ({money(ss.annual ?? 0)}/yr) at age {ss.claimAge}
                </span>
              {:else}
                <span class="text-amber-700 dark:text-amber-300 text-xs">
                  Not calculated yet — run Social Security → Calculate benefits first (age {ss.claimAge})
                </span>
              {/if}
            </div>
          {/each}
        </div>

        <label class="block rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
          <span class="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Monthly insurance until Medicare
          </span>
          <div class="flex items-center gap-2">
            <span class="text-gray-500">$</span>
            <input
              type="number"
              min="0"
              step="25"
              class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2"
              bind:value={confirmInsurance}
            />
            <span class="text-gray-500 shrink-0">/mo</span>
          </div>
          <p class="text-xs text-gray-500">
            {#if medicareGapYears > 0}
              Applied from retirement age {$planStore.primary.retirementAge} until Medicare at
              {$planStore.primary.medicareStartAge}
              ({medicareGapYears} year{medicareGapYears === 1 ? '' : 's'} ·
              {money(confirmInsurance * 12)}/yr in today’s dollars).
            {:else}
              No gap years in this plan (retirement age is at or after Medicare start age
              {$planStore.primary.medicareStartAge}) — this amount won’t be charged.
            {/if}
            Medicare Part B ({money($planStore.taxStrategy.monthlyMedicarePartB ?? 0, 2)}/mo per person) is listed above and charged from the later of retirement and Medicare start.
          </p>
        </label>

        <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-1">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Bitcoin strategy
          </p>
          {#if confirmLiquidateBitcoin && bitcoinHoldings.usd > 0}
            <p class="text-gray-900 dark:text-white font-medium">
              Override — sell all Bitcoin today
            </p>
            <p class="text-xs text-gray-500">
              Saved playbook is {bitcoinPlaybook.title}. This run parks net proceeds in HYSA / brokerage instead.
            </p>
          {:else}
            <p class="text-gray-900 dark:text-white font-medium">{bitcoinPlaybook.title}</p>
            {#each bitcoinPlaybook.details as line}
              <p class="text-xs text-gray-500">{line}</p>
            {/each}
          {/if}
        </div>

        {#if bitcoinHoldings.usd > 0}
          <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
            <label class="flex items-start gap-2">
              <input
                type="checkbox"
                class="mt-1 rounded"
                bind:checked={confirmLiquidateBitcoin}
              />
              <span>
                <span class="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Sell all Bitcoin today
                </span>
                <span class="mt-0.5 block text-xs text-gray-500">
                  Override the playbook for this run only. Converts
                  {#if bitcoinHoldings.btc != null}
                    {bitcoinHoldings.btc.toLocaleString(undefined, { maximumFractionDigits: 8 })} BTC
                    ({money(bitcoinHoldings.usd)})
                  {:else}
                    {money(bitcoinHoldings.usd)}
                  {/if}
                  into cash. Estimated federal LTCG is withheld so year-one taxes are not double-counted. Your saved plan still holds Bitcoin.
                </span>
              </span>
            </label>
            {#if confirmLiquidateBitcoin}
              <div class="space-y-2 pl-6">
                <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>HYSA {confirmHysaPercent.toFixed(0)}%</span>
                  <span>Brokerage {(100 - confirmHysaPercent).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  class="w-full"
                  bind:value={confirmHysaPercent}
                />
                <p class="text-xs text-gray-500">
                  Gross {money(bitcoinLiquidationPreview.gross)}
                  · est. tax {money(bitcoinLiquidationPreview.tax)}
                  · net {money(bitcoinLiquidationPreview.net)}
                  → HYSA {money(bitcoinLiquidationPreview.toHysa)},
                  brokerage {money(bitcoinLiquidationPreview.toBrokerage)}
                </p>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="flex justify-end gap-2 border-t border-gray-100 dark:border-gray-800 px-5 py-4">
        <button type="button" class="btn-secondary" on:click={closeConfirm}>Cancel</button>
        <button type="button" class="btn-primary" on:click={confirmAndRun}>
          Run simulation
        </button>
      </div>
    </div>
  </div>
{/if}

{#if jsonOpen}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
    role="presentation"
    on:click|self={closeJson}
    on:keydown={(e) => e.key === 'Escape' && closeJson()}
  >
    <div
      class="max-h-[90dvh] overflow-hidden flex flex-col w-full max-w-3xl rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl"
      use:dialogFocus={closeJson}
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mc-json-title"
    >
      <div class="border-b border-gray-100 dark:border-gray-800 px-5 py-4 flex items-start justify-between gap-3">
        <div>
          <h3 id="mc-json-title" class="text-lg font-semibold text-gray-900 dark:text-white">
            Scenario JSON
          </h3>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Full forensic trail for this path — copy and share for analysis.
          </p>
        </div>
        <button type="button" class="btn-secondary px-3 py-1.5 text-sm" on:click={copyScenarioJson}>
          {jsonCopied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <textarea
        readonly
        class="flex-1 min-h-[50vh] w-full resize-none bg-gray-50 dark:bg-gray-950 px-5 py-4 font-mono text-[11px] leading-relaxed text-gray-800 dark:text-gray-200 outline-none"
        value={jsonText}
      ></textarea>
      <div class="flex justify-end border-t border-gray-100 dark:border-gray-800 px-5 py-3">
        <button type="button" class="btn-secondary" on:click={closeJson}>Close</button>
      </div>
    </div>
  </div>
{/if}

{#if storyOpen && scenarioStory}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
    role="presentation"
    on:click|self={closeStory}
    on:keydown={(e) => e.key === 'Escape' && closeStory()}
  >
    <div
      class="max-h-[90dvh] overflow-hidden flex flex-col w-full max-w-[105rem] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl"
      use:dialogFocus={closeStory}
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mc-story-title"
    >
      <div class="border-b border-gray-100 dark:border-gray-800 px-5 py-4">
        <h3 id="mc-story-title" class="text-lg font-semibold text-gray-900 dark:text-white">
          {scenarioStory.heading}
        </h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Each year is a chapter: conversions, sales, premiums, and other key moves on this path.
        </p>
      </div>
      <div class="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
        <div class="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
          {#each scenarioStory.intro as item}
            <p class={storyToneClass(item.tone)}>{item.text}</p>
          {/each}
        </div>
        {#each scenarioStory.chapters as chapter, i}
          <article class="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
            <div class="flex items-baseline justify-between gap-3">
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white">
                Chapter {i + 1} · {chapter.title}
              </h4>
              <span class="text-[11px] text-gray-500 shrink-0">{chapter.lines.length} notes</span>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400">{chapter.summary}</p>
            <ul class="space-y-1 text-sm text-gray-800 dark:text-gray-200">
              {#each chapter.lines as item}
                <li class={storyToneClass(item.tone)}>{item.text}</li>
              {/each}
            </ul>
          </article>
        {/each}
        <div class="space-y-1.5 text-sm text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-3">
          {#each scenarioStory.closer as item}
            <p class={storyToneClass(item.tone)}>{item.text}</p>
          {/each}
        </div>
      </div>
      <div class="flex justify-end border-t border-gray-100 dark:border-gray-800 px-5 py-3">
        <button type="button" class="btn-secondary" on:click={closeStory}>Close</button>
      </div>
    </div>
  </div>
{/if}

{#if chartOpen}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/50"
    role="presentation"
    on:click|self={closeCharts}
    on:keydown={(e) => e.key === 'Escape' && closeCharts()}
  >
    <div
      class="max-h-[96dvh] h-[96dvh] overflow-hidden flex flex-col w-full max-w-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl"
      use:dialogFocus={closeCharts}
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mc-charts-title"
    >
      <div class="border-b border-gray-100 dark:border-gray-800 px-5 py-4 flex items-start justify-between gap-3">
        <div>
          <h3 id="mc-charts-title" class="text-lg font-semibold text-gray-900 dark:text-white">
            Scenario charts
          </h3>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Turn on series to overlay. USD is on the left; percent and units use the right axes.
            Use JSON when a line still does not make sense.
          </p>
        </div>
        <div class="flex flex-wrap gap-2 shrink-0">
          <button type="button" class="btn-secondary px-3 py-1.5 text-sm" on:click={openScenarioJson}>
            View JSON
          </button>
          <button type="button" class="btn-secondary px-3 py-1.5 text-sm" on:click={closeCharts}>
            Close
          </button>
        </div>
      </div>

      <div class="flex-1 min-h-0 grid md:grid-cols-[18rem_minmax(0,1fr)]">
        <aside class="border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800 overflow-y-auto p-4 space-y-4">
          {#each forensicGroups as group}
            <div>
              <div class="flex items-center justify-between gap-2 mb-1.5">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {group.title}
                </p>
                <span class="flex gap-2 text-[11px]">
                  <button
                    type="button"
                    class="text-blue-700 dark:text-blue-300 hover:underline"
                    on:click={() => setForensicGroup(group.series.map((s) => s.id), true)}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    class="text-gray-500 hover:underline"
                    on:click={() => setForensicGroup(group.series.map((s) => s.id), false)}
                  >
                    None
                  </button>
                </span>
              </div>
              <div class="flex flex-col gap-1">
                {#each group.series as series}
                  <label class="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200 cursor-pointer">
                    <input
                      type="checkbox"
                      class="rounded border-gray-300 dark:border-gray-600"
                      value={series.id}
                      bind:group={forensicEnabledIds}
                      on:change={() => void renderForensicChart()}
                    />
                    <span
                      class="h-2.5 w-2.5 shrink-0 border border-black/10 dark:border-white/20"
                      style="background:{forensicStyleById[series.id]?.color ?? series.color}; {series.dashed
                        ? 'border-radius: 2px;'
                        : 'border-radius: 9999px;'}"
                    ></span>
                    <span>{series.label}</span>
                    <span class="ml-auto text-[10px] uppercase tracking-wide text-gray-400">
                      {series.scale === 'pct' ? '%' : series.scale === 'units' ? 'u' : '$'}
                    </span>
                  </label>
                {/each}
              </div>
            </div>
          {/each}
        </aside>

        <div class="relative h-full min-h-[320px] p-4">
          <canvas bind:this={forensicCanvas}></canvas>
          {#if forensicEnabledIds.length === 0}
            <div
              class="absolute inset-4 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400 bg-white/80 dark:bg-gray-900/80"
            >
              Turn on at least one series to plot this path.
            </div>
          {/if}
        </div>
      </div>

      <div class="flex flex-wrap justify-between gap-2 border-t border-gray-100 dark:border-gray-800 px-5 py-3">
        <div class="flex gap-2">
          <button type="button" class="btn-secondary text-sm" on:click={resetForensicSeries}>
            Reset defaults
          </button>
          <button type="button" class="btn-secondary text-sm" on:click={clearForensicSeries}>
            Clear
          </button>
        </div>
        <button type="button" class="btn-secondary" on:click={closeCharts}>Close</button>
      </div>
    </div>
  </div>
{/if}

{#if spendTip}
  <div
    class="pointer-events-none fixed z-40 max-w-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs shadow-lg"
    style="left: {spendTip.x}px; top: {spendTip.y}px"
    role="tooltip"
  >
    <p class="font-medium text-gray-900 dark:text-white">{spendTip.title}</p>
    {#if spendTip.lines.length}
      <ul class="mt-1 space-y-0.5 text-gray-600 dark:text-gray-400">
        {#each spendTip.lines.filter((l) => !l.upcoming) as line}
          <li class="flex justify-between gap-3">
            <span>{line.label}</span>
            <span class="tabular-nums shrink-0">{money(line.amount)}</span>
          </li>
        {/each}
        {#if spendTip.lines.some((l) => l.upcoming)}
          <li class="pt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Later</li>
          {#each spendTip.lines.filter((l) => l.upcoming) as line}
            <li class="flex justify-between gap-3">
              <span>{line.label}</span>
              <span class="tabular-nums shrink-0">{money(line.amount)}</span>
            </li>
          {/each}
        {/if}
      </ul>
      <p
        class="mt-1 flex justify-between gap-3 font-medium text-gray-900 dark:text-white border-t border-gray-100 dark:border-gray-800 pt-1"
      >
        <span>Total now</span>
        <span class="tabular-nums">{money(spendTip.total)}</span>
      </p>
    {/if}
    {#if spendTip.stats}
      <ul class="mt-2 space-y-0.5 text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-1">
        <li class="flex justify-between gap-3">
          <span>Success</span>
          <span class="tabular-nums shrink-0">{pct(spendTip.stats.successRate)}</span>
        </li>
        <li class="flex justify-between gap-3">
          <span>25th–75th</span>
          <span class="tabular-nums shrink-0">{money(spendTip.stats.p25)}–{money(spendTip.stats.p75)}</span>
        </li>
        <li class="flex justify-between gap-3">
          <span>Median</span>
          <span class="tabular-nums shrink-0">{money(spendTip.stats.p50)}</span>
        </li>
        <li class="flex justify-between gap-3">
          <span>Mean</span>
          <span class="tabular-nums shrink-0">{money(spendTip.stats.mean)}</span>
        </li>
        <li class="flex justify-between gap-3">
          <span>Std. dev.</span>
          <span class="tabular-nums shrink-0">{money(spendTip.stats.stdev)}</span>
        </li>
      </ul>
    {/if}
  </div>
{/if}
