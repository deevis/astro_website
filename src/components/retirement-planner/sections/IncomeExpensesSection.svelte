<script lang="ts">
  import { planStore } from '../lib/planStore';
  import {
    EXPENSE_CATEGORY_LABELS,
    incomeEndsAtRetirement,
    newId,
    type ExpenseCategory,
    type ExpenseItem,
    type IncomeStream,
  } from '../lib/types';
  import PlannerPanel from '../PlannerPanel.svelte';
  import EmptyState from '../EmptyState.svelte';

  function addIncome() {
    planStore.update((plan) => {
      const isFirst = plan.income.length === 0;
      const stream: IncomeStream = {
        id: newId('inc'),
        label: isFirst ? 'Salary' : 'Other income',
        annualAmount: 0,
        startAge: plan.primary.currentAge,
        endAge: isFirst ? plan.primary.retirementAge : null,
        owner: 'primary',
        taxable: true,
        endsAtRetirement: isFirst,
      };
      return { ...plan, income: [...plan.income, stream] };
    });
  }

  function addExpense() {
    planStore.update((plan) => {
      const item: ExpenseItem = {
        id: newId('exp'),
        label: 'Living expenses',
        annualAmount: 0,
        startAge: plan.primary.currentAge,
        endAge: null,
        category: 'general',
      };
      return { ...plan, expenses: [...plan.expenses, item] };
    });
  }

  function removeIncome(id: string) {
    planStore.update((plan) => ({
      ...plan,
      income: plan.income.filter((s) => s.id !== id),
    }));
  }

  function removeExpense(id: string) {
    planStore.update((plan) => ({
      ...plan,
      expenses: plan.expenses.filter((e) => e.id !== id),
    }));
  }

  function setPrimaryIncome(id: string, enabled: boolean) {
    planStore.update((plan) => ({
      ...plan,
      income: plan.income.map((s) => ({
        ...s,
        endsAtRetirement: s.id === id ? enabled : s.endsAtRetirement,
        endAge: s.id === id && !enabled ? null : s.endAge,
      })),
    }));
  }

  function ownerRetirementAge(owner: IncomeStream['owner']): number {
    if (owner === 'spouse' && $planStore.spouse) return $planStore.spouse.retirementAge;
    return $planStore.primary.retirementAge;
  }

  function isPrimary(stream: IncomeStream): boolean {
    return incomeEndsAtRetirement(stream, $planStore.income);
  }
</script>

<div class="space-y-6">
  <PlannerPanel
    title="Income"
    description="Wages, pensions, rental income, and other cash inflows. Primary earned income ends at your Household retirement age. Social Security is configured in its own section."
  >
    <svelte:fragment slot="actions">
      <div class="mt-3">
        <button type="button" class="btn-secondary" on:click={addIncome}>+ Add income</button>
      </div>
    </svelte:fragment>
    {#if $planStore.income.length === 0}
      <EmptyState
        title="No income streams yet"
        message="Add salaries, pensions, rental income, or annuities so the projection knows what funds your plan before and during retirement."
      />
    {:else}
      <ul class="space-y-3">
        {#each $planStore.income as stream, i (stream.id)}
          <li class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
            <div class="grid gap-3 md:grid-cols-5">
              <label class="block text-sm md:col-span-2">
                <span class="text-gray-600 dark:text-gray-400">Label</span>
                <input
                  class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
                  bind:value={$planStore.income[i].label}
                />
              </label>
              <label class="block text-sm">
                <span class="text-gray-600 dark:text-gray-400">Annual ($)</span>
                <input
                  type="number"
                  min="0"
                  class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
                  bind:value={$planStore.income[i].annualAmount}
                />
              </label>
              <label class="block text-sm">
                <span class="text-gray-600 dark:text-gray-400">Start age</span>
                <input
                  type="number"
                  class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
                  bind:value={$planStore.income[i].startAge}
                />
              </label>
              <div class="flex items-end gap-2">
                <label class="block text-sm flex-1">
                  <span class="text-gray-600 dark:text-gray-400">End age</span>
                  {#if isPrimary(stream)}
                    <input
                      type="number"
                      class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-gray-700 dark:text-gray-300"
                      value={ownerRetirementAge(stream.owner)}
                      readonly
                      title="Synced from Household retirement age"
                    />
                    <span class="mt-0.5 block text-[11px] text-gray-500">
                      Synced from Household retirement age
                    </span>
                  {:else}
                    <input
                      type="number"
                      class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
                      value={$planStore.income[i].endAge ?? ''}
                      placeholder="Ongoing"
                      on:input={(e) => {
                        const v = e.currentTarget.value;
                        $planStore.income[i].endAge = v === '' ? null : Number(v);
                      }}
                    />
                  {/if}
                </label>
                <button
                  type="button"
                  class="mb-2 text-sm text-red-600 dark:text-red-400"
                  on:click={() => removeIncome(stream.id)}
                >
                  ✕
                </button>
              </div>
            </div>

            <div class="flex flex-wrap gap-4 items-center">
              <label class="text-sm">Income owner
                <select class="field-input" bind:value={$planStore.income[i].owner}>
                  <option value="primary">Primary</option>
                  {#if $planStore.spouse}<option value="spouse">Spouse</option><option value="joint">Joint</option>{/if}
                </select>
              </label>
              <label class="flex gap-2 text-sm"><input type="checkbox" bind:checked={$planStore.income[i].taxable} />Taxable income</label>
            </div>
            <label class="inline-flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" class="mt-0.5" checked={isPrimary(stream)} on:change={(e) => setPrimaryIncome(stream.id, e.currentTarget.checked)} />
              <span>Ends when this person retires (age {ownerRetirementAge(stream.owner)})<span class="block text-xs text-gray-500">Turn off for pensions or income that continues in retirement.</span></span>
            </label>
          </li>
        {/each}
      </ul>
    {/if}
  </PlannerPanel>

  <PlannerPanel
    title="Expenses"
    description="Annual spending, tagged by category so Monte Carlo forensic years can break out general, travel, and health insurance. Set a separate in-retirement amount to model a spending step-down after you stop working."
  >
    <svelte:fragment slot="actions">
      <div class="mt-3">
        <button type="button" class="btn-secondary" on:click={addExpense}>+ Add expense</button>
      </div>
    </svelte:fragment>
    {#if $planStore.expenses.length === 0}
      <EmptyState
        title="No expenses yet"
        message="Add at least one expense (e.g. living expenses) — projections and Monte Carlo runs need spending to test against."
      />
    {:else}
      <ul class="space-y-3">
        {#each $planStore.expenses as item, i (item.id)}
          <li class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 grid gap-3 md:grid-cols-6">
            <label class="block text-sm md:col-span-2">
              <span class="text-gray-600 dark:text-gray-400">Label</span>
              <input
                class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
                bind:value={$planStore.expenses[i].label}
              />
            </label>
            <label class="block text-sm">
              <span class="text-gray-600 dark:text-gray-400">Category</span>
              <select
                class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
                value={$planStore.expenses[i].category ?? 'general'}
                on:change={(e) => {
                  $planStore.expenses[i].category = e.currentTarget.value as ExpenseCategory;
                }}
              >
                {#each Object.entries(EXPENSE_CATEGORY_LABELS) as [value, label]}
                  <option value={value}>{label}</option>
                {/each}
              </select>
            </label>
            <label class="block text-sm">
              <span class="text-gray-600 dark:text-gray-400">Annual ($)</span>
              <input
                type="number"
                min="0"
                class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
                bind:value={$planStore.expenses[i].annualAmount}
              />
            </label>
            <label class="block text-sm">
              <span class="text-gray-600 dark:text-gray-400">In retirement ($)</span>
              <input
                type="number"
                min="0"
                class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
                value={$planStore.expenses[i].retirementAnnualAmount ?? ''}
                on:input={(e) => {
                  const v = e.currentTarget.value;
                  $planStore.expenses[i].retirementAnnualAmount =
                    v === '' ? undefined : Number(v);
                }}
              />
            </label>
            <div class="flex items-end">
              <button
                type="button"
                class="mb-2 text-sm text-red-600 dark:text-red-400"
                on:click={() => removeExpense(item.id)}
              >
                Remove
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </PlannerPanel>
</div>
