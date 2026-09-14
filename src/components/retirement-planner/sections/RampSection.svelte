<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount, tick } from 'svelte';
  import { get } from 'svelte/store';
  import { planStore } from '../lib/planStore';
  import { money } from '../lib/cashflow';
  import { readyForProjection } from '../lib/planHealth';
  import {
    analyzeRampAveragePath,
    IRA_PENALTY_FREE_AGE,
    RAMP_MC_RUNS,
    type RampAverageProgress,
    type RampPillarResult,
    type RampResult,
  } from '../lib/rampAnalysis';
  import { loadChartJs, type ChartInstance } from '../lib/loadChart';
  import type { PlannerSectionId } from '../lib/types';
  import PlannerPanel from '../PlannerPanel.svelte';
  import EmptyState from '../EmptyState.svelte';

  const dispatch = createEventDispatcher<{ navigate: PlannerSectionId }>();

  $: planReady = readyForProjection($planStore);
  let result: RampResult | null = null;
  let running = false;
  let cancelFlag = false;
  let runId = 0;
  let error = '';
  let progress: RampAverageProgress | null = null;
  let accessCanvas: HTMLCanvasElement;
  let accessChart: ChartInstance | null = null;
  let lastChartKey = '';
  let expanded: Record<string, boolean> = {};

  onMount(() => {
    if (planReady) void runAveragePath();
  });

  onDestroy(() => {
    runId++;
    cancelFlag = true;
    accessChart?.destroy();
    accessChart = null;
    lastChartKey = '';
  });

  function accessChartKey(r: RampResult): string {
    const { accessible, locked, need } = r.accessibleBreakdown;
    return `${accessible}|${locked}|${need}`;
  }

  async function runAveragePath() {
    if (!planReady || running) return;
    const currentRun = ++runId;
    error = '';
    running = true;
    cancelFlag = false;
    progress = { completed: 0, total: RAMP_MC_RUNS, message: 'Starting…' };
    try {
      const plan = structuredClone(get(planStore));
      const out = await analyzeRampAveragePath(plan, {
        runs: RAMP_MC_RUNS,
        onProgress: (p) => {
          if (currentRun === runId) progress = p;
        },
        shouldCancel: () => cancelFlag || currentRun !== runId,
      });
      if (currentRun !== runId) return;
      result = out;
      lastChartKey = '';
      await tick();
      await renderAccessChart(out, currentRun);
    } catch (e) {
      if (currentRun !== runId || (e instanceof Error && e.name === 'AbortError')) return;
      error = e instanceof Error ? e.message : 'Analysis failed.';
    } finally {
      if (currentRun === runId) { running = false; progress = null; }
    }
  }

  function stopRun() {
    runId++;
    cancelFlag = true;
    running = false;
    progress = null;
  }

  function toggleExpand(id: string) {
    expanded = { ...expanded, [id]: !expanded[id] };
  }

  function setInsuranceMonthly(raw: string) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    planStore.update((plan) => ({
      ...plan,
      taxStrategy: {
        ...plan.taxStrategy,
        monthlyInsuranceUntilMedicare: Math.max(0, n),
      },
    }));
  }

  function navigate(section: PlannerSectionId) {
    dispatch('navigate', section);
  }

  function statusBadge(status: RampPillarResult['status']): string {
    if (status === 'pass') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
    if (status === 'fail') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
    if (status === 'warn') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
    return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }

  function statusLabel(status: RampPillarResult['status']): string {
    if (status === 'pass') return 'Pass';
    if (status === 'fail') return 'Fail';
    if (status === 'warn') return 'Review';
    return 'N/A';
  }

  function pillarBorder(status: RampPillarResult['status']): string {
    if (status === 'pass') return 'border-emerald-200 dark:border-emerald-900/50';
    if (status === 'fail') return 'border-red-200 dark:border-red-900/50';
    if (status === 'warn') return 'border-amber-200 dark:border-amber-900/50';
    return 'border-gray-200 dark:border-gray-700';
  }

  function timelineLeft(age: number, minAge: number, maxAge: number): string {
    if (maxAge <= minAge) return '0%';
    const pct = ((age - minAge) / (maxAge - minAge)) * 100;
    return `${Math.max(0, Math.min(100, pct))}%`;
  }

  $: timelineMarkers = (result?.timeline ?? []).filter((marker, index, all) => all.findIndex((item) => item.age === marker.age) === index).map((marker) => ({ ...marker, label: result!.timeline.filter((item) => item.age === marker.age).map((item) => item.label).join(' / ') }));

  $: timelineMin = result
    ? Math.min(
        $planStore.primary.currentAge,
        result.retirementAge,
        IRA_PENALTY_FREE_AGE,
        $planStore.primary.medicareStartAge
      )
    : $planStore.primary.currentAge;
  $: timelineMax = result
    ? Math.max(
        result.firstGuaranteedIncomeAge,
        $planStore.primary.medicareStartAge,
        IRA_PENALTY_FREE_AGE,
        $planStore.primary.lifeExpectancy - 5
      )
    : $planStore.primary.lifeExpectancy;
  $: runwayBandLeft = result
    ? timelineLeft(result.retirementAge, timelineMin, timelineMax)
    : '0%';
  $: runwayBandWidth = (() => {
    if (!result) return '0%';
    const span = timelineMax - timelineMin;
    if (span <= 0) return '0%';
    return `${((result.runwayYears / span) * 100).toFixed(1)}%`;
  })();
  $: pre59BandWidth = (() => {
    if (!result || result.retirementAge >= IRA_PENALTY_FREE_AGE) return '0%';
    const pre59End = Math.min(result.firstGuaranteedIncomeAge, IRA_PENALTY_FREE_AGE);
    const years = pre59End - result.retirementAge;
    const span = timelineMax - timelineMin;
    if (span <= 0 || years <= 0) return '0%';
    return `${((years / span) * 100).toFixed(1)}%`;
  })();

  async function renderAccessChart(r: RampResult, currentRun: number) {
    await tick();
    if (!accessCanvas) return;

    const key = accessChartKey(r);
    if (key === lastChartKey && accessChart) return;
    lastChartKey = key;

    const Chart = await loadChartJs();
    if (currentRun !== runId || !accessCanvas?.isConnected) return;
    const isDark = document.documentElement.classList.contains('dark');
    const tickColor = isDark ? '#94a3b8' : '#64748b';

    const { accessible, locked, need } = r.accessibleBreakdown;

    if (accessChart) {
      accessChart.data.datasets[0].data = [accessible];
      accessChart.data.datasets[1].data = [locked];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (accessChart as any).$needValue = need;
      accessChart.update('none');
      return;
    }

    accessChart = new Chart(accessCanvas, {
      type: 'bar',
      data: {
        labels: ['At retirement'],
        datasets: [
          {
            label: 'Accessible',
            data: [accessible],
            backgroundColor: '#059669',
            stack: 'assets',
          },
          {
            label: 'Locked (pre-59½)',
            data: [locked],
            backgroundColor: '#94a3b8',
            stack: 'assets',
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { labels: { color: tickColor, boxWidth: 12, font: { size: 11 } } },
        },
        scales: {
          x: {
            stacked: true,
            ticks: {
              color: tickColor,
              callback: (v) => '$' + Number(v).toLocaleString(),
            },
            grid: { color: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.15)' },
          },
          y: {
            stacked: true,
            ticks: { color: tickColor },
            grid: { display: false },
          },
        },
      },
      plugins: [
        {
          id: 'needLine',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          afterDraw(chart: any) {
            const needValue = chart.$needValue ?? 0;
            if (needValue <= 0) return;
            const x = chart.scales.x;
            const y = chart.scales.y;
            if (!x || !y) return;
            const px = x.getPixelForValue(needValue);
            const ctx = chart.ctx;
            ctx.save();
            ctx.strokeStyle = '#dc2626';
            ctx.setLineDash([6, 4]);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px, y.top);
            ctx.lineTo(px, y.bottom);
            ctx.stroke();
            ctx.fillStyle = '#dc2626';
            ctx.font = '11px sans-serif';
            ctx.fillText(`Need ${money(needValue)}`, px + 4, y.top + 14);
            ctx.restore();
          },
        },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (accessChart as any).$needValue = need;
  }

  $: if (!planReady && accessChart) {
    accessChart.destroy();
    accessChart = null;
    lastChartKey = '';
  }

  $: pillars = result
    ? [result.runway, result.accessible, result.medical, result.portfolio]
    : [];
  $: overallBanner =
    result?.overall === 'pass'
      ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100'
      : 'border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100';
</script>

<div class="space-y-6">
  {#if !planReady}
    <EmptyState
      title="RAMP needs a plan first"
      message="Add assets and spending in Household, Assets, and Income & Expenses — then return here for the pre-flight checklist."
    />
  {:else}
    <PlannerPanel
      title="RAMP Checklist"
      description="Evaluates ability on the median (average) Monte Carlo path — sequence of returns and Bitcoin/crypto → HYSA harvest included. {RAMP_MC_RUNS} light runs; not a full Monte Carlo."
    >
      <svelte:fragment slot="actions">
        <div class="mt-3 flex flex-wrap items-center gap-2">
          {#if running}
            <button type="button" class="btn-secondary" on:click={stopRun}>Cancel</button>
            {#if progress}
              <span class="text-xs text-gray-500">
                {progress.message}
                ({progress.completed}/{progress.total})
              </span>
            {/if}
          {:else}
            <button type="button" class="btn-primary" on:click={runAveragePath}>
              {result ? 'Re-run average-path analysis' : 'Run average-path analysis'}
            </button>
          {/if}
        </div>
      </svelte:fragment>
    </PlannerPanel>

    {#if error}<p role="alert" class="text-sm text-red-600 dark:text-red-400">{error}</p>{/if}
    {#if running && !result}
      <p class="text-sm text-gray-600 dark:text-gray-400">
        Sampling return paths to find the median scenario…
      </p>
    {:else if result}
      <div class="rounded-xl border px-5 py-4 text-sm {overallBanner}">
        <p class="font-semibold">
          {#if result.overall === 'pass'}
            All RAMP checks passed — capability and ability align
          {:else}
            {result.passedCount} of {result.totalChecks} checks passed
            {#if result.failedPillars.length > 0}
              — fix {result.failedPillars.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')} before retiring
            {/if}
          {/if}
        </p>
        <p class="mt-1 opacity-90 leading-relaxed">
          Having enough saved is <strong>capability</strong>. RAMP proves <strong>ability</strong> —
          including whether Bitcoin counts toward your liquid buffer, and whether harvest
          into HYSA still refills cash when that sleeve is short.
        </p>
        {#if result.pathMode === 'average' && result.mcRuns}
          <p class="mt-2 text-xs opacity-80">
            Based on the median ending-balance path from {result.mcRuns} runs
            {#if result.mcSuccessRate != null}
              · sample success {(result.mcSuccessRate * 100).toFixed(0)}%
            {/if}
            {#if result.medianEndingBalance != null}
              · median ending {money(result.medianEndingBalance)}
            {/if}
            {#if (result.cryptoHarvestOnPath ?? 0) > 0}
              · harvested {money(result.cryptoHarvestOnPath ?? 0)} BTC/crypto → HYSA on this path
            {/if}
          </p>
        {/if}
      </div>

      <PlannerPanel
        title="Life timeline"
        description="Runway (portfolio-only years) and the pre-59½ accessible window — the two periods that trip up early retirees."
      >
        <div class="relative pt-8 pb-6">
          <div
            class="absolute h-2 rounded-full bg-gray-200 dark:bg-gray-700"
            style="left: 0; right: 0; top: 2.5rem;"
          ></div>
          {#if result.runwayYears > 0}
            <div
              class="absolute h-2 rounded-full bg-blue-400/70 dark:bg-blue-600/60"
              style="left: {runwayBandLeft}; width: {runwayBandWidth}; top: 2.5rem;"
              title="Runway: portfolio-only years"
            ></div>
          {/if}
          {#if result.retirementAge < IRA_PENALTY_FREE_AGE}
            <div
              class="absolute h-2 rounded-full bg-violet-400/80 dark:bg-violet-600/70"
              style="left: {runwayBandLeft}; width: {pre59BandWidth}; top: 2.5rem;"
              title="Pre-59½ accessible window"
            ></div>
          {/if}
          {#each timelineMarkers as marker (marker.age)}
            <div
              class="absolute flex flex-col items-center -translate-x-1/2"
              style="left: {timelineLeft(marker.age, timelineMin, timelineMax)}; top: 0;"
            >
              <span
                class="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 whitespace-nowrap"
                >{marker.label}</span
              >
              <span
                class="mt-1 h-3 w-3 rounded-full ring-2 ring-white dark:ring-gray-900 {marker.kind === 'retire'
                  ? 'bg-blue-500'
                  : marker.kind === 'penaltyFree'
                    ? 'bg-violet-500'
                    : marker.kind === 'medicare'
                      ? 'bg-teal-500'
                      : marker.kind === 'ss'
                        ? 'bg-amber-500'
                        : marker.kind === 'income'
                          ? 'bg-orange-500'
                          : 'bg-gray-400'}"
              ></span>
              <span class="mt-1 text-xs tabular-nums text-gray-600 dark:text-gray-400"
                >{marker.age === IRA_PENALTY_FREE_AGE ? '59½' : marker.age}</span
              >
            </div>
          {/each}
        </div>
        <div class="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span class="flex items-center gap-1.5"
            ><span class="inline-block h-2 w-4 rounded bg-blue-400/70"></span> Runway ({result.runwayYears}
            yr{result.runwayYears === 1 ? '' : 's'})</span
          >
          <span class="flex items-center gap-1.5"
            ><span class="inline-block h-2 w-4 rounded bg-violet-400/80"></span> Pre-59½ window</span
          >
        </div>
      </PlannerPanel>

      <div class="grid gap-4 sm:grid-cols-2">
        {#each pillars as pillar (pillar.id)}
          <div
            class="rounded-xl border bg-white dark:bg-gray-900/40 shadow-sm px-4 py-4 {pillarBorder(pillar.status)}"
          >
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {pillar.label}
                </p>
                <p class="mt-1 font-semibold text-gray-900 dark:text-white">{pillar.headline}</p>
              </div>
              <span
                class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {statusBadge(pillar.status)}"
              >
                {statusLabel(pillar.status)}
              </span>
            </div>
            <dl class="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              {#each pillar.metrics as m}
                <div>
                  <dt class="text-[11px] text-gray-500">{m.label}</dt>
                  <dd class="font-medium tabular-nums text-gray-900 dark:text-white">{m.value}</dd>
                </div>
              {/each}
            </dl>
            {#if pillar.id === 'medical' && result.medical.status === 'fail'}
              <label class="mt-3 block text-sm">
                <span class="text-gray-600 dark:text-gray-400">Monthly insurance until Medicare ($)</span>
                <input
                  type="number"
                  min="0"
                  step="50"
                  class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2"
                  value={$planStore.taxStrategy.monthlyInsuranceUntilMedicare ?? 750}
                  on:change={(e) => setInsuranceMonthly(e.currentTarget.value)}
                />
              </label>
            {/if}
            <button
              type="button"
              class="mt-3 text-xs text-primary-600 dark:text-primary-400 hover:underline"
              on:click={() => toggleExpand(pillar.id)}
            >
              {expanded[pillar.id] ? 'Hide details' : 'Show details'}
            </button>
            {#if expanded[pillar.id]}
              <p class="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{pillar.detail}</p>
              {#if pillar.remediation.length > 0}
                <ul class="mt-2 list-disc pl-4 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  {#each pillar.remediation as tip}
                    <li>{tip}</li>
                  {/each}
                </ul>
              {/if}
            {/if}
          </div>
        {/each}
      </div>

      {#if result.harvestYearsOnRunway && result.harvestYearsOnRunway.length > 0}
        <PlannerPanel
          title="BTC/crypto sales on this path"
          description="Years where near-ATH harvest or balanced trim moved Bitcoin/crypto into HYSA after estimated capital-gains tax. Configure the playbook in the Bitcoin section."
        >
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead
                class="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400"
              >
                <tr>
                  <th class="py-1.5 pr-3 font-medium">Age</th>
                  <th class="py-1.5 pr-3 font-medium text-right">Gross sold</th>
                  <th class="py-1.5 pr-3 font-medium text-right">Est. tax</th>
                  <th class="py-1.5 pr-3 font-medium text-right">Net → HYSA</th>
                  <th class="py-1.5 pr-3 font-medium text-right">BTC sold</th>
                  <th class="py-1.5 pr-3 font-medium text-right">BTC price</th>
                  <th class="py-1.5 pr-3 font-medium text-right">Metals</th>
                  <th class="py-1.5 font-medium text-right">Other crypto</th>
                </tr>
              </thead>
              <tbody>
                {#each result.harvestYearsOnRunway as h}
                  <tr class="border-t border-gray-100 dark:border-gray-800">
                    <td class="py-1.5 pr-3 text-gray-700 dark:text-gray-300">{h.age}</td>
                    <td class="py-1.5 pr-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {money(h.grossUsd)}
                    </td>
                    <td class="py-1.5 pr-3 text-right tabular-nums text-amber-700 dark:text-amber-300">
                      {h.taxUsd > 0 ? money(h.taxUsd) : '—'}
                    </td>
                    <td
                      class="py-1.5 pr-3 text-right tabular-nums font-medium text-emerald-700 dark:text-emerald-300"
                      >{money(h.amount)}</td
                    >
                    <td class="py-1.5 pr-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {#if h.bitcoinBtc != null && h.bitcoinBtc > 0}
                        {h.bitcoinBtc.toFixed(4)} BTC
                        <span class="block text-[11px] text-gray-500">{money(h.bitcoinUsd)}</span>
                      {:else if h.bitcoinUsd > 0}
                        {money(h.bitcoinUsd)}
                        <span class="block text-[11px] text-gray-500">Set BTC units for qty</span>
                      {:else}
                        —
                      {/if}
                    </td>
                    <td class="py-1.5 pr-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {h.bitcoinPriceUsd != null ? money(h.bitcoinPriceUsd) : '—'}
                    </td>
                    <td class="py-1.5 pr-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {#if (h.goldUsd ?? 0) + (h.silverUsd ?? 0) > 0}
                        {money((h.goldUsd ?? 0) + (h.silverUsd ?? 0))}
                        <span class="block text-[11px] text-gray-500">
                          {#if (h.goldUsd ?? 0) > 0}Au {money(h.goldUsd)}{/if}
                          {#if (h.goldUsd ?? 0) > 0 && (h.silverUsd ?? 0) > 0} · {/if}
                          {#if (h.silverUsd ?? 0) > 0}Ag {money(h.silverUsd)}{/if}
                        </span>
                      {:else}
                        —
                      {/if}
                    </td>
                    <td class="py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {h.cryptoUsd > 0 ? money(h.cryptoUsd) : '—'}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </PlannerPanel>
      {/if}

      <PlannerPanel
        title="Accessible vs locked"
        description="Penalty-free assets at retirement on the median path, vs need before age 59½."
      >
        <div class="h-28">
          <canvas bind:this={accessCanvas}></canvas>
        </div>
        {#if result.accessibleBreakdown.need > 0}
          <div class="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
            <div>
              <p class="text-xs text-gray-500">Accessible</p>
              <p class="font-semibold text-emerald-700 dark:text-emerald-300">
                {money(result.accessibleBreakdown.accessible)}
              </p>
            </div>
            <div>
              <p class="text-xs text-gray-500">Need (incl. buffer)</p>
              <p class="font-semibold text-red-700 dark:text-red-300">
                {money(result.accessibleBreakdown.need)}
              </p>
            </div>
            <div>
              <p class="text-xs text-gray-500">Coverage</p>
              <p class="font-semibold text-gray-900 dark:text-white">
                {result.accessibleBreakdown.coveragePct.toFixed(0)}%
              </p>
            </div>
          </div>
          {#if result.accessibleBreakdown.buckets.length > 0}
            <ul class="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-400">
              {#each result.accessibleBreakdown.buckets as b}
                <li class="flex justify-between gap-2">
                  <span>{b.label}</span>
                  <span class="tabular-nums font-medium">{money(b.amount)}</span>
                </li>
              {/each}
            </ul>
          {/if}
        {:else if result.accessible.status === 'na'}
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Retiring at or after 59½ — penalty-free access is not a binding constraint.
          </p>
        {/if}
      </PlannerPanel>

      <PlannerPanel title="Quick actions" description="Jump to sections that fix common RAMP failures.">
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn-secondary" on:click={() => navigate('assets')}>
            Assets
          </button>
          <button type="button" class="btn-secondary" on:click={() => navigate('bitcoin')}>
            Bitcoin
          </button>
          <button type="button" class="btn-secondary" on:click={() => navigate('taxStrategy')}>
            Tax Strategy
          </button>
          <button type="button" class="btn-secondary" on:click={() => navigate('household')}>
            Household
          </button>
          <button type="button" class="btn-secondary" on:click={() => navigate('incomeExpenses')}>
            Income &amp; Expenses
          </button>
          <button type="button" class="btn-secondary" on:click={() => navigate('socialSecurity')}>
            Social Security
          </button>
          <button type="button" class="btn-secondary" on:click={() => navigate('dateOptimizer')}>
            Date Optimizer
          </button>
        </div>
      </PlannerPanel>
    {/if}
  {/if}
</div>
