<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { get } from 'svelte/store';
  import { planStore } from '../lib/planStore';
  import { money } from '../lib/cashflow';
  import { loadChartJs, type ChartInstance } from '../lib/loadChart';
  import { readyForProjection } from '../lib/planHealth';
  import {
    cancelMonteCarlo,
  } from '../lib/monteCarlo';
  import {
    runRetirementOptimizer,
    type OptimizerProgress,
    type OptimizerResult,
  } from '../lib/retirementOptimizer';
  import {
    createDefaultOptimizerPreferences,
  } from '../lib/types';
  import PlannerPanel from '../PlannerPanel.svelte';
  import EmptyState from '../EmptyState.svelte';

  $: planReady = readyForProjection($planStore);
  $: prefs = $planStore.optimizerPreferences ?? createDefaultOptimizerPreferences();

  let running = false;
  let runId = 0;
  let progress: OptimizerProgress | null = null;
  let error = '';
  let result: OptimizerResult | null = null;

  let curveCanvas: HTMLCanvasElement;
  let curveChart: ChartInstance | null = null;

  onDestroy(() => {
    runId++;
    cancelMonteCarlo();
    curveChart?.destroy();
  });

  function setPref(
    key: 'retireSooner' | 'higherSpending' | 'certainty' | 'legacy',
    raw: string
  ) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    planStore.update((plan) => ({
      ...plan,
      optimizerPreferences: {
        ...(plan.optimizerPreferences ?? createDefaultOptimizerPreferences()),
        [key]: Math.max(0, Math.min(100, n)),
      },
    }));
  }

  async function startOptimizer() {
    if (!planReady || running) return;
    const currentRun = ++runId;
    error = '';
    running = true;
    progress = { phase: 'monteCarlo', completed: 0, total: 1, message: 'Starting…' };
    result = null;
    curveChart?.destroy();
    curveChart = null;

    try {
      const plan = structuredClone(get(planStore));
      const out = await runRetirementOptimizer(plan, {
        onProgress: (p) => {
          if (currentRun === runId) progress = p;
        },
      });
      if (currentRun !== runId) return;
      result = out;
      await tick();
      await renderCurve(out, currentRun);
    } catch (e) {
      if (currentRun !== runId || (e instanceof Error && e.name === 'AbortError')) return;
      error = e instanceof Error ? e.message : 'Optimizer failed';
    } finally {
      if (currentRun === runId) { running = false; progress = null; }
    }
  }

  function stopOptimizer() {
    runId++;
    cancelMonteCarlo();
    running = false;
    progress = null;
  }

  function applyRetirementAge(age: number) {
    planStore.update((plan) => ({
      ...plan,
      primary: { ...plan.primary, retirementAge: age },
    }));
  }

  async function renderCurve(out: OptimizerResult, currentRun: number) {
    if (!curveCanvas || !out.ages.length) return;
    const Chart = await loadChartJs();
    if (currentRun !== runId || !curveCanvas?.isConnected) return;
    const isDark = document.documentElement.classList.contains('dark');
    const tickColor = isDark ? '#94a3b8' : '#64748b';
    const grid = isDark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.15)';

    const highlight = (age: number | undefined, color: string) =>
      out.ages.map((a) => (a.retirementAge === age ? color : 'transparent'));

    curveChart?.destroy();
    curveChart = new Chart(curveCanvas, {
      type: 'line',
      data: {
        labels: out.ages.map((a) => String(a.retirementAge)),
        datasets: [
          {
            label: 'Success rate %',
            data: out.ages.map((a) => a.successRate * 100),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37,99,235,0.12)',
            fill: true,
            yAxisID: 'y',
            tension: 0.2,
            pointRadius: 3,
            borderWidth: 2,
          },
          {
            label: 'Portfolio at retirement',
            data: out.ages.map((a) => a.portfolioAtRetirement),
            borderColor: '#059669',
            backgroundColor: 'transparent',
            yAxisID: 'y1',
            tension: 0.2,
            pointRadius: 3,
            borderWidth: 2,
          },
          {
            label: 'Earliest',
            data: out.ages.map((a) =>
              a.retirementAge === out.earliestViable?.age ? a.successRate * 100 : null
            ),
            borderColor: 'transparent',
            backgroundColor: highlight(out.earliestViable?.age, '#f59e0b'),
            pointRadius: 8,
            pointStyle: 'rectRot',
            yAxisID: 'y',
            showLine: false,
          },
          {
            label: 'Sweet spot',
            data: out.ages.map((a) =>
              a.retirementAge === out.sweetSpot?.age ? a.successRate * 100 : null
            ),
            borderColor: 'transparent',
            backgroundColor: highlight(out.sweetSpot?.age, '#7c3aed'),
            pointRadius: 9,
            pointStyle: 'star',
            yAxisID: 'y',
            showLine: false,
          },
          {
            label: 'Max security',
            data: out.ages.map((a) =>
              a.retirementAge === out.maxSecurity?.age ? a.successRate * 100 : null
            ),
            borderColor: 'transparent',
            backgroundColor: highlight(out.maxSecurity?.age, '#0f766e'),
            pointRadius: 8,
            pointStyle: 'triangle',
            yAxisID: 'y',
            showLine: false,
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
            title: { display: true, text: 'Retirement age', color: tickColor },
            ticks: { color: tickColor },
            grid: { color: grid },
          },
          y: {
            position: 'left',
            title: { display: true, text: 'Success %', color: tickColor },
            min: 0,
            max: 100,
            ticks: { color: tickColor },
            grid: { color: grid },
          },
          y1: {
            position: 'right',
            title: { display: true, text: 'Portfolio ($)', color: tickColor },
            ticks: {
              color: tickColor,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              callback: (v: any) => '$' + Number(v).toLocaleString(),
            },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });
  }

  function pct(n: number): string {
    return `${(n * 100).toFixed(1)}%`;
  }

  function cardClass(kind: 'earliest' | 'sweet' | 'max'): string {
    if (kind === 'earliest')
      return 'border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20';
    if (kind === 'sweet')
      return 'border-violet-200 dark:border-violet-900/50 bg-violet-50/50 dark:bg-violet-950/20';
    return 'border-teal-200 dark:border-teal-900/50 bg-teal-50/40 dark:bg-teal-950/20';
  }
</script>

<div class="space-y-6">
  <PlannerPanel
    title="Retirement Date Optimizer"
    description="Sweep ages 55–70 to find the earliest viable date, the sweet spot where another year of work stops paying off, and a max-security later date. Uses light Monte Carlo (300 runs) per age."
  >
    <svelte:fragment slot="actions">
      <div class="mt-3 flex gap-2">
        {#if running}
          <button type="button" class="btn-secondary" on:click={stopOptimizer}>Cancel</button>
        {:else}
          <button
            type="button"
            class="btn-primary"
            on:click={startOptimizer}
            disabled={!planReady}
          >
            Run optimizer
          </button>
        {/if}
      </div>
    </svelte:fragment>

    {#if !planReady}
      <EmptyState
        title="Need a working plan first"
        message="Add accounts with balances and income/expenses (and ideally Social Security benefits) before optimizing retirement dates."
      />
    {:else}
      <div class="space-y-4">
        <div>
          <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-2">
            What do you value most?
          </h3>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="block text-sm">
              <span class="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Retire sooner</span>
                <span>{prefs.retireSooner}</span>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                class="mt-1 w-full"
                value={prefs.retireSooner}
                on:input={(e) => setPref('retireSooner', e.currentTarget.value)}
              />
            </label>
            <label class="block text-sm">
              <span class="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Higher spending</span>
                <span>{prefs.higherSpending}</span>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                class="mt-1 w-full"
                value={prefs.higherSpending}
                on:input={(e) => setPref('higherSpending', e.currentTarget.value)}
              />
            </label>
            <label class="block text-sm">
              <span class="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Financial certainty</span>
                <span>{prefs.certainty}</span>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                class="mt-1 w-full"
                value={prefs.certainty}
                on:input={(e) => setPref('certainty', e.currentTarget.value)}
              />
            </label>
            <label class="block text-sm">
              <span class="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Leave a legacy</span>
                <span>{prefs.legacy}</span>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                class="mt-1 w-full"
                value={prefs.legacy}
                on:input={(e) => setPref('legacy', e.currentTarget.value)}
              />
            </label>
          </div>
          <p class="mt-2 text-xs text-gray-500">
            Success threshold: {($planStore.assumptions.successThreshold * 100).toFixed(0)}% (from
            Assumptions). Current Household retirement age:
            {$planStore.primary.retirementAge}.
          </p>
        </div>

        {#if running && progress}
          <div class="space-y-2">
            <div class="flex justify-between text-xs text-gray-500">
              <span>{progress.message}</span>
              <span>{progress.completed} / {progress.total}</span>
            </div>
            <div class="h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
              <div
                class="h-full bg-primary-600 transition-all"
                style="width: {progress.total
                  ? Math.min(100, (progress.completed / progress.total) * 100)
                  : 0}%"
              ></div>
            </div>
          </div>
        {/if}

        {#if error}
          <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
        {/if}
      </div>
    {/if}
  </PlannerPanel>

  {#if result}
    <div class="grid gap-4 md:grid-cols-3">
      <div class="rounded-xl border p-4 space-y-2 {cardClass('earliest')}">
        <p class="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
          Earliest viable
        </p>
        {#if result.earliestViable}
          <p class="text-3xl font-semibold text-gray-900 dark:text-white">
            Age {result.earliestViable.age}
          </p>
          <p class="text-sm text-gray-700 dark:text-gray-300">{result.earliestViable.reason}</p>
          <button
            type="button"
            class="btn-secondary text-xs"
            on:click={() => {
              const age = result?.earliestViable?.age;
              if (age != null) applyRetirementAge(age);
            }}
          >
            Use this age
          </button>
        {:else}
          <p class="text-sm text-gray-600 dark:text-gray-400">
            No age in 55–70 meets your success threshold with current spending.
          </p>
        {/if}
      </div>

      <div class="rounded-xl border p-4 space-y-2 {cardClass('sweet')}">
        <p class="text-xs font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-200">
          Recommended sweet spot
        </p>
        {#if result.sweetSpot}
          <p class="text-3xl font-semibold text-gray-900 dark:text-white">
            Age {result.sweetSpot.age}
          </p>
          <p class="text-sm text-gray-700 dark:text-gray-300">{result.sweetSpot.reason}</p>
          <button
            type="button"
            class="btn-primary text-xs"
            on:click={() => {
              const age = result?.sweetSpot?.age;
              if (age != null) applyRetirementAge(age);
            }}
          >
            Use this age
          </button>
        {:else}
          <p class="text-sm text-gray-600 dark:text-gray-400">Could not determine a sweet spot.</p>
        {/if}
      </div>

      <div class="rounded-xl border p-4 space-y-2 {cardClass('max')}">
        <p class="text-xs font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-200">
          Maximum security
        </p>
        {#if result.maxSecurity}
          <p class="text-3xl font-semibold text-gray-900 dark:text-white">
            Age {result.maxSecurity.age}
          </p>
          <p class="text-sm text-gray-700 dark:text-gray-300">{result.maxSecurity.reason}</p>
          <button
            type="button"
            class="btn-secondary text-xs"
            on:click={() => {
              const age = result?.maxSecurity?.age;
              if (age != null) applyRetirementAge(age);
            }}
          >
            Use this age
          </button>
        {:else}
          <p class="text-sm text-gray-600 dark:text-gray-400">No max-security candidate.</p>
        {/if}
      </div>
    </div>

    <PlannerPanel title="Retirement-date curve" description="">
      <div
        class="h-[320px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-3"
      >
        <canvas bind:this={curveCanvas}></canvas>
      </div>
      <p class="mt-2 text-xs text-gray-500">
        At what point does another year of working and saving cost more in lived life than it
        meaningfully improves the plan? The sweet spot marks that elbow.
      </p>
    </PlannerPanel>

    <PlannerPanel title="Comparison by retirement age" description="">
      <div
        class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 max-h-80 overflow-y-auto"
      >
        <table class="min-w-full text-xs">
          <thead
            class="sticky top-0 bg-gray-50 dark:bg-gray-800 text-left text-gray-600 dark:text-gray-400"
          >
            <tr>
              <th class="px-2 py-1.5 font-medium">Age</th>
              <th class="px-2 py-1.5 font-medium">Success</th>
              <th class="px-2 py-1.5 font-medium">$ at retirement</th>
              <th class="px-2 py-1.5 font-medium">Legacy (p50)</th>
              <th class="px-2 py-1.5 font-medium">p10 ending</th>
              <th class="px-2 py-1.5 font-medium">Save until then</th>
              <th class="px-2 py-1.5 font-medium">Gap yrs</th>
              <th class="px-2 py-1.5 font-medium">Δ score</th>
              <th class="px-2 py-1.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {#each result.ages as row}
              {@const isSweet = result.sweetSpot?.age === row.retirementAge}
              {@const isEarly = result.earliestViable?.age === row.retirementAge}
              {@const isMax = result.maxSecurity?.age === row.retirementAge}
              <tr
                class="border-t border-gray-200 dark:border-gray-700 {isSweet
                  ? 'bg-violet-50/70 dark:bg-violet-950/30'
                  : isEarly
                    ? 'bg-amber-50/50 dark:bg-amber-950/20'
                    : isMax
                      ? 'bg-teal-50/40 dark:bg-teal-950/20'
                      : ''}"
              >
                <td class="px-2 py-1.5 font-medium">{row.retirementAge}</td>
                <td
                  class="px-2 py-1.5 {row.meetsThreshold
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'}"
                >
                  {pct(row.successRate)}
                </td>
                <td class="px-2 py-1.5">{money(row.portfolioAtRetirement)}</td>
                <td class="px-2 py-1.5">{money(row.legacyP50)}</td>
                <td class="px-2 py-1.5">{money(row.legacyP10)}</td>
                <td class="px-2 py-1.5">{money(row.totalContributionsUntilRetirement)}</td>
                <td class="px-2 py-1.5">{row.gapInsuranceYears}</td>
                <td class="px-2 py-1.5">
                  {row.marginalScoreGain >= 0 ? '+' : ''}{row.marginalScoreGain.toFixed(3)}
                </td>
                <td class="px-2 py-1.5 text-gray-500">
                  {#if isSweet}Sweet{/if}
                  {#if isEarly}{isSweet ? ' · ' : ''}Earliest{/if}
                  {#if isMax}{isSweet || isEarly ? ' · ' : ''}Max{/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </PlannerPanel>

    {#if result.savingsRelevance}
      <PlannerPanel
        title="What continued saving buys"
        description="Same sweet-spot retirement age, with vs without future HYSA / 401(k) employee contributions and match."
      >
        <div class="grid gap-4 sm:grid-cols-2 text-sm">
          <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p class="text-xs uppercase tracking-wide text-gray-500">With continued saving</p>
            <p class="mt-1 text-gray-900 dark:text-white">
              Success {pct(result.savingsRelevance.withSaving.successRate)} · spend
              {money(result.savingsRelevance.withSaving.plannedAnnualSpend)}/yr
            </p>
          </div>
          <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p class="text-xs uppercase tracking-wide text-gray-500">If you stop contributing</p>
            <p class="mt-1 text-gray-900 dark:text-white">
              Success {pct(result.savingsRelevance.withoutSaving.successRate)} · spend
              {money(result.savingsRelevance.withoutSaving.plannedAnnualSpend)}/yr
            </p>
          </div>
        </div>
        <p class="mt-3 text-sm text-gray-700 dark:text-gray-300">
          {result.savingsRelevance.summary}
        </p>
        <p class="mt-1 text-xs text-gray-500">
          Δ success {(result.savingsRelevance.deltaSuccessRate * 100).toFixed(1)} pp
        </p>
      </PlannerPanel>
    {/if}
  {/if}
</div>
