<script lang="ts">
  import { planStore } from '../lib/planStore';
  import PlannerPanel from '../PlannerPanel.svelte';
  import {
    bracketCeiling,
    irmaaFirstCliff,
  } from '../lib/taxBrackets';
  import { MEDICARE_PART_B_MONTHLY_2026 } from '../lib/types';

  $: filing = $planStore.filingStatus === 'married' ? 'married' : 'single';
  $: bracketTop = bracketCeiling(filing, $planStore.taxStrategy.targetFederalBracketCeiling);
  $: irmaaCliff = irmaaFirstCliff(filing);

  function setBracketPct(display: string) {
    const n = Number(display) / 100;
    if (!Number.isFinite(n)) return;
    planStore.update((plan) => ({
      ...plan,
      taxStrategy: { ...plan.taxStrategy, targetFederalBracketCeiling: n },
    }));
  }

  function setExpenseCutPct(display: string) {
    const n = Number(display) / 100;
    if (!Number.isFinite(n)) return;
    planStore.update((plan) => ({
      ...plan,
      taxStrategy: { ...plan.taxStrategy, downYearExpenseCut: Math.min(0.5, Math.max(0, n)) },
    }));
  }

  function addConversionYear() {
    const schedule = $planStore.taxStrategy.customConversionByYear;
    let year = new Date().getFullYear();
    while (schedule.some((row) => row.year === year)) year++;
    planStore.update((plan) => ({ ...plan, taxStrategy: { ...plan.taxStrategy, customConversionByYear: [...schedule, { year, amount: 10000 }] } }));
  }
</script>

<PlannerPanel
  title="Tax & Spending Strategy"
  description="Choose spending adjustments, cash reserves, and Traditional → Roth conversions in the retirement gap before Social Security."
>
  <p class="mb-4 text-sm text-gray-500">Federal estimates use 2026 brackets and standard deductions, inflated for later years. They omit state taxes, credits, age-based deductions and Medicare surcharge costs.</p>
  <div class="grid gap-4 sm:grid-cols-2">
    <label class="block text-sm">
      <span class="text-gray-600 dark:text-gray-400">Roth conversion policy</span>
      <select
        class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
        bind:value={$planStore.taxStrategy.rothConversionPolicy}
      >
        <option value="none">None</option>
        <option value="fillBracket">Fill federal bracket</option>
        <option value="irmaaAware">IRMAA-aware fill (recommended)</option>
        <option value="customSchedule">Custom schedule by year</option>
      </select>
    </label>
    <label class="block text-sm">
      <span class="text-gray-600 dark:text-gray-400">Target federal bracket</span>
      <select
        class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
        value={($planStore.taxStrategy.targetFederalBracketCeiling * 100).toFixed(0)}
        on:change={(e) => setBracketPct(e.currentTarget.value)}
      >
        <option value="12">12%</option>
        <option value="22">22%</option>
        <option value="24">24%</option>
        <option value="32">32%</option>
      </select>
      <span class="mt-1 block text-xs text-gray-500">
        Approx. taxable-income ceiling: ${bracketTop.toLocaleString()}
      </span>
    </label>
    <label class="block text-sm">
      <span class="text-gray-600 dark:text-gray-400">RMD policy</span>
      <select
        class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
        bind:value={$planStore.taxStrategy.rmdPolicy}
      >
        <option value="minimumOnly">Minimum only</option>
        <option value="spendFromRmdFirst">Spend RMD first</option>
        <option value="convertBeforeRmd">Shrink before RMD</option>
      </select>
    </label>
    <label class="block text-sm">
      <span class="text-gray-600 dark:text-gray-400">Down-year expense cut (%)</span>
      <input
        type="number"
        min="0"
        max="50"
        step="1"
        class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
        value={(($planStore.taxStrategy.downYearExpenseCut ?? 0.1) * 100).toFixed(0)}
        on:input={(e) => setExpenseCutPct(e.currentTarget.value)}
      />
      <span class="mt-1 block text-xs text-gray-500">Applied when portfolio return is negative</span>
    </label>
  </div>

  {#if $planStore.taxStrategy.rothConversionPolicy === 'customSchedule'}
    <div class="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <p class="text-sm">Scheduled conversions still respect the pre–Social Security window, bracket ceiling and available tax cash.</p>
      {#each $planStore.taxStrategy.customConversionByYear as row, i}
        <div class="flex flex-wrap items-end gap-3">
          <label class="text-sm">Calendar year<input aria-label={'Conversion year ' + (i + 1)} class="field-input" type="number" min="1900" max="2200" bind:value={row.year} /></label>
          <label class="text-sm">Amount ($)<input aria-label={'Conversion amount ' + (i + 1)} class="field-input" type="number" min="0" step="100" bind:value={row.amount} /></label>
          <button type="button" class="btn-danger" aria-label={'Remove conversion ' + (i + 1)} on:click={() => planStore.update((plan) => ({ ...plan, taxStrategy: { ...plan.taxStrategy, customConversionByYear: plan.taxStrategy.customConversionByYear.filter((_, index) => index !== i) } }))}>Remove</button>
        </div>
      {/each}
      <button type="button" class="btn-secondary" on:click={addConversionYear}>Add conversion year</button>
    </div>
  {/if}
  <label class="block text-sm">
    <span class="text-gray-600 dark:text-gray-400">Monthly insurance before Medicare ($)</span>
    <input class="field-input max-w-xs" type="number" min="0" step="1" bind:value={$planStore.taxStrategy.monthlyInsuranceUntilMedicare} />
    <span class="block mt-1 text-xs text-gray-500">Added from retirement until your Medicare start age, increasing with inflation.</span>
  </label>
  <label class="block text-sm">
    <span class="text-gray-600 dark:text-gray-400">Monthly Medicare Part B premium ($ / person)</span>
    <input class="field-input max-w-xs" type="number" min="0" step="1" bind:value={$planStore.taxStrategy.monthlyMedicarePartB} />
    <span class="block mt-1 text-xs text-gray-500">
      Standard Part B, charged from the later of retirement and Medicare start age (and for a spouse at their ages). Inflates with the plan. Default is the 2026 CMS premium (${MEDICARE_PART_B_MONTHLY_2026.toFixed(2)}). IRMAA surcharges are not added on top.
    </span>
  </label>
  <div class="space-y-3 text-sm text-gray-700 dark:text-gray-300">
    <label class="flex items-start gap-2">
      <input type="checkbox" class="mt-1 rounded" bind:checked={$planStore.taxStrategy.irmaaAvoidance} />
      <span>
        <span class="font-medium text-gray-900 dark:text-white">Stay under the first IRMAA cliff</span>
        <span class="block text-xs text-gray-500 mt-0.5">
          First Part B surcharge begins above ~${irmaaCliff.toLocaleString()} MAGI ({filing === 'married' ? 'joint' : 'single'}).
          Especially important in years before Medicare (IRMAA uses a two-year lookback).
        </span>
      </span>
    </label>
    <label class="flex items-start gap-2">
      <input
        type="checkbox"
        class="mt-1 rounded"
        bind:checked={$planStore.taxStrategy.convertInSsGapYears}
      />
      <span>
        <span class="font-medium text-gray-900 dark:text-white">Convert in the pre–Social Security gap</span>
        <span class="block text-xs text-gray-500 mt-0.5">
          After retirement and before claiming SS, fill the bracket / IRMAA room with Traditional → Roth
          conversions. Tax is paid from cash or brokerage when available.
        </span>
      </span>
    </label>
    <label class="flex items-start gap-2">
      <input
        type="checkbox"
        class="mt-1 rounded"
        bind:checked={$planStore.taxStrategy.favorCashInDownYears}
      />
      <span>
        <span class="font-medium text-gray-900 dark:text-white">Favor cash in down markets</span>
        <span class="block text-xs text-gray-500 mt-0.5">
          Withdraw from HYSA / CDs / bonds / brokerage before selling retirement accounts or Bitcoin.
        </span>
      </span>
    </label>
    <p class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 p-3 text-xs text-gray-500">
      Bitcoin and crypto sales (near-ATH harvest and balanced trim) are configured in the
      <strong>Bitcoin</strong> section.
    </p>
  </div>

  <div
    class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 p-4 text-xs text-gray-600 dark:text-gray-400 leading-relaxed"
  >
    These rules run automatically in both the deterministic projection and Monte Carlo paths. Bracket and
    IRMAA figures are planning approximations, not a tax filing engine.
  </div>
</PlannerPanel>
