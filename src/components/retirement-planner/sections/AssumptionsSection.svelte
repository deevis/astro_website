<script lang="ts">
  import { planStore } from '../lib/planStore';
  import { createDefaultMarketCycle, type MarketCycleAssumptions } from '../lib/types';
  import PlannerPanel from '../PlannerPanel.svelte';

  type PctKey =
    | 'inflationRate'
    | 'equityReturn'
    | 'equityVolatility'
    | 'bondReturn'
    | 'bondVolatility'
    | 'cashReturn'
    | 'cashVolatility'
    | 'cryptoReturn'
    | 'cryptoVolatility'
    | 'goldReturn'
    | 'goldVolatility'
    | 'silverReturn'
    | 'silverVolatility'
    | 'withdrawalRate'
    | 'successThreshold';

  function pct(value: number): string {
    return (value * 100).toFixed(1);
  }

  function setPct(key: PctKey, display: string) {
    const n = Number(display) / 100;
    if (!Number.isFinite(n)) return;
    planStore.update((plan) => ({
      ...plan,
      assumptions: { ...plan.assumptions, [key]: n },
    }));
  }

  function setCyclePct(key: keyof MarketCycleAssumptions, display: string) {
    const n = Number(display) / 100;
    if (!Number.isFinite(n)) return;
    planStore.update((plan) => ({
      ...plan,
      assumptions: {
        ...plan.assumptions,
        marketCycle: { ...plan.assumptions.marketCycle, [key]: n },
      },
    }));
  }

  function setCycleRaw(key: keyof MarketCycleAssumptions, display: string) {
    const n = Number(display);
    if (!Number.isFinite(n)) return;
    planStore.update((plan) => ({
      ...plan,
      assumptions: {
        ...plan.assumptions,
        marketCycle: { ...plan.assumptions.marketCycle, [key]: n },
      },
    }));
  }

  function resetCycleDefaults() {
    planStore.update((plan) => ({
      ...plan,
      assumptions: { ...plan.assumptions, marketCycle: createDefaultMarketCycle() },
    }));
  }

  $: cycle = $planStore.assumptions.marketCycle ?? createDefaultMarketCycle();
  $: normalShare = Math.max(0, 1 - cycle.recessionProbability - cycle.boomProbability);
  $: recessionYearMean = $planStore.assumptions.equityReturn + cycle.recessionEquityShift;
  $: boomYearMean = $planStore.assumptions.equityReturn + cycle.boomEquityShift;

  const inputClass =
    'mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2';
</script>

<div class="space-y-6">
  <PlannerPanel
    title="Returns & Inflation"
    description="Long-run average annual returns and volatility by asset class. Cash/HYSA/CD defaults apply to savings accounts; bond settings apply to bond holdings. Values are entered as percentages."
  >
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Inflation (%)</span>
        <input
          type="number"
          step="0.1"
          class={inputClass}
          value={pct($planStore.assumptions.inflationRate)}
          on:input={(e) => setPct('inflationRate', e.currentTarget.value)}
        />
      </label>
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Equity return (%)</span>
        <input
          type="number"
          step="0.1"
          class={inputClass}
          value={pct($planStore.assumptions.equityReturn)}
          on:input={(e) => setPct('equityReturn', e.currentTarget.value)}
        />
      </label>
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Equity volatility (%)</span>
        <input
          type="number"
          step="0.1"
          class={inputClass}
          value={pct($planStore.assumptions.equityVolatility)}
          on:input={(e) => setPct('equityVolatility', e.currentTarget.value)}
        />
      </label>
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Bond return (%)</span>
        <input
          type="number"
          step="0.1"
          class={inputClass}
          value={pct($planStore.assumptions.bondReturn)}
          on:input={(e) => setPct('bondReturn', e.currentTarget.value)}
        />
      </label>
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Bond volatility (%)</span>
        <input
          type="number"
          step="0.1"
          class={inputClass}
          value={pct($planStore.assumptions.bondVolatility)}
          on:input={(e) => setPct('bondVolatility', e.currentTarget.value)}
        />
      </label>
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Cash / HYSA / CD yield (%)</span>
        <input
          type="number"
          step="0.1"
          class={inputClass}
          value={pct($planStore.assumptions.cashReturn ?? 0.04)}
          on:input={(e) => setPct('cashReturn', e.currentTarget.value)}
        />
        <span class="mt-1 block text-xs text-gray-500">Fallback when an account has no return set</span>
      </label>
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Cash volatility (%)</span>
        <input
          type="number"
          step="0.1"
          class={inputClass}
          value={pct($planStore.assumptions.cashVolatility ?? 0.005)}
          on:input={(e) => setPct('cashVolatility', e.currentTarget.value)}
        />
        <span class="mt-1 block text-xs text-gray-500">Rate drift only — typically under 1%</span>
      </label>
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Crypto return (%)</span>
        <input
          type="number"
          step="0.1"
          class={inputClass}
          value={pct($planStore.assumptions.cryptoReturn)}
          on:input={(e) => setPct('cryptoReturn', e.currentTarget.value)}
        />
      </label>
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Crypto volatility (%)</span>
        <input
          type="number"
          step="0.1"
          class={inputClass}
          value={pct($planStore.assumptions.cryptoVolatility)}
          on:input={(e) => setPct('cryptoVolatility', e.currentTarget.value)}
        />
      </label>
      <p class="sm:col-span-2 lg:col-span-3 text-xs text-gray-500 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 p-3">
        Bitcoin return, volatility, price path, and the sell playbook (near-ATH harvest vs balanced trim) live in the
        <strong>Bitcoin</strong> section.
      </p>
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Gold return (%)</span>
        <input
          type="number"
          step="0.1"
          class={inputClass}
          value={pct($planStore.assumptions.goldReturn ?? 0.045)}
          on:input={(e) => setPct('goldReturn', e.currentTarget.value)}
        />
        <span class="mt-1 block text-xs text-gray-500">Long-run real metal path</span>
      </label>
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Gold volatility (%)</span>
        <input
          type="number"
          step="0.1"
          class={inputClass}
          value={pct($planStore.assumptions.goldVolatility ?? 0.16)}
          on:input={(e) => setPct('goldVolatility', e.currentTarget.value)}
        />
      </label>
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Silver return (%)</span>
        <input
          type="number"
          step="0.1"
          class={inputClass}
          value={pct($planStore.assumptions.silverReturn ?? 0.05)}
          on:input={(e) => setPct('silverReturn', e.currentTarget.value)}
        />
      </label>
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Silver volatility (%)</span>
        <input
          type="number"
          step="0.1"
          class={inputClass}
          value={pct($planStore.assumptions.silverVolatility ?? 0.28)}
          on:input={(e) => setPct('silverVolatility', e.currentTarget.value)}
        />
        <span class="mt-1 block text-xs text-gray-500">Higher than gold; industrial beta</span>
      </label>
    </div>
  </PlannerPanel>

  <PlannerPanel
    title="Market Cycles (Monte Carlo)"
    description="Defaults are calibrated to S&P 500 calendar-year returns (1986–2025). Equity paths use a block bootstrap of that history — contiguous real years, not independent crash draws — so fantasy markets (8 down years in 14, dual −40% years) cannot appear."
  >
    <svelte:fragment slot="actions">
      <div class="mt-3">
        <button type="button" class="btn-secondary" on:click={resetCycleDefaults}>
          Reset to historical defaults
        </button>
      </div>
    </svelte:fragment>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Down-year probability (%)</span>
        <input
          type="number"
          step="1"
          min="0"
          max="50"
          class={inputClass}
          value={pct(cycle.recessionProbability)}
          on:input={(e) => setCyclePct('recessionProbability', e.currentTarget.value)}
        />
        <span class="mt-1 block text-xs text-gray-500">S&amp;P 1986–2025: 9 of 40 years ≈ 22%</span>
      </label>
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Down-year persistence (%)</span>
        <input
          type="number"
          step="1"
          min="0"
          max="90"
          class={inputClass}
          value={pct(cycle.recessionPersistence)}
          on:input={(e) => setCyclePct('recessionPersistence', e.currentTarget.value)}
        />
        <span class="mt-1 block text-xs text-gray-500">Chance a down year repeats (history: 2 of 9 ≈ 22%)</span>
      </label>
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Max consecutive down years</span>
        <input
          type="number"
          step="1"
          min="1"
          max="10"
          class={inputClass}
          value={cycle.maxRecessionStreak ?? 3}
          on:input={(e) => setCycleRaw('maxRecessionStreak', e.currentTarget.value)}
        />
        <span class="mt-1 block text-xs text-gray-500">Historical max in sample: 3 (2000–2002)</span>
      </label>
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Recession equity shift (%)</span>
        <input
          type="number"
          step="1"
          class={inputClass}
          value={pct(cycle.recessionEquityShift)}
          on:input={(e) => setCyclePct('recessionEquityShift', e.currentTarget.value)}
        />
        <span class="mt-1 block text-xs text-gray-500">
          Used when historical bootstrap is off · parametric mean {(recessionYearMean * 100).toFixed(0)}%
        </span>
      </label>
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Boom probability / year (%)</span>
        <input
          type="number"
          step="1"
          min="0"
          max="50"
          class={inputClass}
          value={pct(cycle.boomProbability)}
          on:input={(e) => setCyclePct('boomProbability', e.currentTarget.value)}
        />
        <span class="mt-1 block text-xs text-gray-500">S&amp;P ≥20% years: ~32% of sample</span>
      </label>
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Max consecutive boom years</span>
        <input
          type="number"
          step="1"
          min="1"
          max="10"
          class={inputClass}
          value={cycle.maxBoomStreak ?? 4}
          on:input={(e) => setCycleRaw('maxBoomStreak', e.currentTarget.value)}
        />
        <span class="mt-1 block text-xs text-gray-500">Historical max in sample: 4 (1995–1998)</span>
      </label>
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Boom equity shift (%)</span>
        <input
          type="number"
          step="1"
          class={inputClass}
          value={pct(cycle.boomEquityShift)}
          on:input={(e) => setCyclePct('boomEquityShift', e.currentTarget.value)}
        />
        <span class="mt-1 block text-xs text-gray-500">
          Parametric boom mean: {(boomYearMean * 100).toFixed(0)}%
        </span>
      </label>
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Crypto cycle multiplier (×)</span>
        <input
          type="number"
          step="0.5"
          min="0"
          max="5"
          class={inputClass}
          value={cycle.cryptoRegimeMultiplier}
          on:input={(e) => setCycleRaw('cryptoRegimeMultiplier', e.currentTarget.value)}
        />
        <span class="mt-1 block text-xs text-gray-500">How strongly crypto amplifies the cycle (2× default)</span>
      </label>
    </div>

    <label class="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
      <input
        type="checkbox"
        class="mt-1 rounded"
        checked={cycle.useHistoricalEquityBootstrap !== false}
        on:change={(e) => {
          const on = e.currentTarget.checked;
          planStore.update((plan) => ({
            ...plan,
            assumptions: {
              ...plan.assumptions,
              marketCycle: { ...plan.assumptions.marketCycle, useHistoricalEquityBootstrap: on },
            },
          }));
        }}
      />
      <span>
        <span class="font-medium text-gray-900 dark:text-white">Bootstrap equity returns from S&amp;P history</span>
        <span class="block text-xs text-gray-500 mt-0.5">
          Recommended. Equity years come from contiguous blocks of real S&amp;P history (not
          independent crash dice-rolls). Single-year equity losses are capped near the 2008 worst
          (~−40%). Failure examples that invent fantasy markets are filtered out.
        </span>
      </span>
    </label>

    <div
      class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 p-4 text-sm text-gray-700 dark:text-gray-300"
    >
      <p class="font-medium text-gray-900 dark:text-white mb-2">Regime mix per simulated year</p>
      <div class="flex h-3 w-full overflow-hidden rounded-full">
        <div class="bg-red-500/80" style="width: {cycle.recessionProbability * 100}%" title="Recession"></div>
        <div class="bg-gray-400/60 dark:bg-gray-600" style="width: {normalShare * 100}%" title="Normal"></div>
        <div class="bg-emerald-500/80" style="width: {cycle.boomProbability * 100}%" title="Boom"></div>
      </div>
      <div class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
        <span><span class="inline-block h-2 w-2 rounded-full bg-red-500/80"></span> Down {(cycle.recessionProbability * 100).toFixed(0)}%</span>
        <span><span class="inline-block h-2 w-2 rounded-full bg-gray-400/60"></span> Mid {(normalShare * 100).toFixed(0)}%</span>
        <span><span class="inline-block h-2 w-2 rounded-full bg-emerald-500/80"></span> Boom {(cycle.boomProbability * 100).toFixed(0)}%</span>
      </div>
      <p class="mt-2 text-xs text-gray-500">
        Persistence is capped by max consecutive down years. After a streak ends, the next year cannot
        immediately re-enter a recession. Bonds/cash stay parametric; crypto still uses the cycle multiplier.
      </p>
    </div>
  </PlannerPanel>

  <PlannerPanel
    title="Withdrawals & Simulation"
    description="How spending is funded and how many Monte Carlo paths to simulate."
  >
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Withdrawal rate (%)</span>
        <input
          type="number"
          step="0.1"
          class={inputClass}
          value={pct($planStore.assumptions.withdrawalRate)}
          on:input={(e) => setPct('withdrawalRate', e.currentTarget.value)}
        />
        <span class="mt-1 block text-xs text-gray-500">Used only when not spending from plan</span>
      </label>
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Monte Carlo runs</span>
        <input
          type="number"
          min="100"
          max="10000"
          step="100"
          class={inputClass}
          bind:value={$planStore.assumptions.monteCarloRuns}
        />
        <span class="mt-1 block text-xs text-gray-500">1,000 is a good balance of speed and stability</span>
      </label>
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Success threshold (%)</span>
        <input
          type="number"
          step="1"
          class={inputClass}
          value={pct($planStore.assumptions.successThreshold)}
          on:input={(e) => setPct('successThreshold', e.currentTarget.value)}
        />
        <span class="mt-1 block text-xs text-gray-500">80–90% is a common planning target</span>
      </label>
    </div>

    <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
      <input type="checkbox" bind:checked={$planStore.assumptions.useSpendFromPlan} class="rounded" />
      Use plan expenses for withdrawals (instead of fixed withdrawal rate)
    </label>
  </PlannerPanel>
</div>
