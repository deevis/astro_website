<script lang="ts">
  import { planStore } from '../lib/planStore';
  import type { FilingStatus } from '../lib/types';
  import { computeFutureWorkYears, createDefaultPerson, BIRTH_MONTH_LABELS } from '../lib/types';
  import PlannerPanel from '../PlannerPanel.svelte';

  function setBirthMonth(who: 'primary' | 'spouse', raw: string) {
    const month = Number(raw);
    planStore.update((plan) => {
      if (who === 'spouse') {
        if (!plan.spouse) return plan;
        return { ...plan, spouse: { ...plan.spouse, birthMonth: month } };
      }
      return { ...plan, primary: { ...plan.primary, birthMonth: month } };
    });
  }

  /** Nested bind:value does not go through the store — re-run derived sync. */
  function syncDerivedFromAges() {
    planStore.update((plan) => plan);
  }

  function setFilingStatus(status: FilingStatus) {
    planStore.update((plan) => {
      const next = { ...plan, filingStatus: status };
      if (status === 'married' && !next.spouse) {
        next.spouse = createDefaultPerson('Spouse');
        if (!next.socialSecurity.some((s) => s.owner === 'spouse')) {
          next.socialSecurity = [
            ...next.socialSecurity,
            {
              owner: 'spouse',
              earningsHistory: [],
              claimAge: 67,
              futureWorkYears: computeFutureWorkYears(
                next.spouse.currentAge,
                next.spouse.retirementAge
              ),
              futureAnnualEarnings: 0,
            },
          ];
        }
      }
      if (status === 'single') {
        next.spouse = null;
        next.socialSecurity = next.socialSecurity.filter((s) => s.owner === 'primary');
      }
      return next;
    });
  }
</script>

<PlannerPanel
  title="Household"
  description="Single or joint filing, ages, birth month, and life expectancy. Retirement age also drives Social Security future work years and when salary stops. Birth month prorates leftover pay in the current year and through your birthday in the retirement year. Medicare start age controls the end of your private-insurance spending."
>
  {#if $planStore}
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$planStore.filingStatus === 'single'
          ? 'bg-primary-600 text-white'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}"
        on:click={() => setFilingStatus('single')}
      >
        Single
      </button>
      <button
        type="button"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$planStore.filingStatus === 'married'
          ? 'bg-primary-600 text-white'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}"
        on:click={() => setFilingStatus('married')}
      >
        Married (joint)
      </button>
    </div>

    <div class="grid gap-6 md:grid-cols-2">
      <fieldset class="space-y-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <legend class="px-1 text-sm font-semibold text-gray-900 dark:text-white">Primary</legend>
        <label class="block text-sm">
          <span class="text-gray-600 dark:text-gray-400">Name</span>
          <input
            class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
            bind:value={$planStore.primary.name}
          />
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="block text-sm">
            <span class="text-gray-600 dark:text-gray-400">Current age</span>
            <input
              type="number"
              min="18"
              max="100"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
              bind:value={$planStore.primary.currentAge}
              on:change={syncDerivedFromAges}
              on:input={syncDerivedFromAges}
            />
          </label>
          <label class="block text-sm">
            <span class="text-gray-600 dark:text-gray-400">Retirement age</span>
            <input
              type="number"
              min="40"
              max="80"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
              bind:value={$planStore.primary.retirementAge}
              on:change={syncDerivedFromAges}
              on:input={syncDerivedFromAges}
            />
          </label>
          <label class="block text-sm col-span-2">
            <span class="text-gray-600 dark:text-gray-400">Birth month</span>
            <select
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
              value={$planStore.primary.birthMonth ?? 7}
              on:change={(e) => setBirthMonth('primary', e.currentTarget.value)}
            >
              {#each BIRTH_MONTH_LABELS as label, i}
                <option value={i + 1}>{label}</option>
              {/each}
            </select>
            <span class="mt-0.5 block text-[11px] text-gray-500">
              Salary from today through this month in the year you reach retirement age. Day of month is not stored.
            </span>
          </label>
          <label class="block text-sm">
            <span class="text-gray-600 dark:text-gray-400">Life expectancy</span>
            <input
              type="number"
              min="50"
              max="120"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
              bind:value={$planStore.primary.lifeExpectancy}
            />
          </label>
          <label class="block text-sm">
            <span class="text-gray-600 dark:text-gray-400">Medicare start age</span>
            <input
              type="number"
              min="65"
              max="70"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
              bind:value={$planStore.primary.medicareStartAge}
            />
          </label>
        </div>
      </fieldset>

      {#if $planStore.filingStatus === 'married' && $planStore.spouse}
        <fieldset class="space-y-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <legend class="px-1 text-sm font-semibold text-gray-900 dark:text-white">Spouse</legend>
          <label class="block text-sm">
            <span class="text-gray-600 dark:text-gray-400">Name</span>
            <input
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
              bind:value={$planStore.spouse.name}
            />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block text-sm">
              <span class="text-gray-600 dark:text-gray-400">Current age</span>
              <input
                type="number"
                min="18"
                max="100"
                class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
                bind:value={$planStore.spouse.currentAge}
                on:change={syncDerivedFromAges}
                on:input={syncDerivedFromAges}
              />
            </label>
            <label class="block text-sm">
              <span class="text-gray-600 dark:text-gray-400">Retirement age</span>
              <input
                type="number"
                min="40"
                max="80"
                class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
                bind:value={$planStore.spouse.retirementAge}
                on:change={syncDerivedFromAges}
                on:input={syncDerivedFromAges}
              />
            </label>
            <label class="block text-sm col-span-2">
              <span class="text-gray-600 dark:text-gray-400">Birth month</span>
              <select
                class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
                value={$planStore.spouse.birthMonth ?? 7}
                on:change={(e) => setBirthMonth('spouse', e.currentTarget.value)}
              >
                {#each BIRTH_MONTH_LABELS as label, i}
                  <option value={i + 1}>{label}</option>
                {/each}
              </select>
            </label>
            <label class="block text-sm">
              <span class="text-gray-600 dark:text-gray-400">Life expectancy</span>
              <input
                type="number"
                min="50"
                max="120"
                class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
                bind:value={$planStore.spouse.lifeExpectancy}
              />
            </label>
            <label class="block text-sm">
              <span class="text-gray-600 dark:text-gray-400">Medicare start age</span>
              <input
                type="number"
                min="65"
                max="70"
                class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
                bind:value={$planStore.spouse.medicareStartAge}
              />
            </label>
          </div>
        </fieldset>
      {/if}
    </div>

    <label class="field-label max-w-md">
      <span>Plan name</span>
      <input class="field-input" bind:value={$planStore.name} />
    </label>
  {/if}
</PlannerPanel>
