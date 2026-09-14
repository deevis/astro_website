<script lang="ts">
  import { dialogFocus } from '../lib/dialogFocus';
  import { planStore } from '../lib/planStore';
  import {
    createEmptyRealEstateProperty,
    realEstateNetEquity,
    type RealEstateKind,
    type RealEstateProperty,
  } from '../lib/types';
  import { money } from '../lib/cashflow';
  import PlannerPanel from '../PlannerPanel.svelte';
  import EmptyState from '../EmptyState.svelte';

  let editingId: string | null = null;
  let isNew = false;
  let draft: RealEstateProperty | null = null;

  $: editing =
    editingId != null
      ? $planStore.realEstate?.find((p) => p.id === editingId) ?? null
      : null;

  $: properties = $planStore.realEstate ?? [];
  $: totalEquity = properties.reduce((s, p) => s + realEstateNetEquity(p), 0);
  $: totalValue = properties.reduce((s, p) => s + Math.max(0, p.estimatedValue), 0);
  $: rentalNoi = properties
    .filter((p) => p.kind === 'rental')
    .reduce((s, p) => s + p.netIncomeAnnual, 0);

  function addProperty(kind: RealEstateKind) {
    const prop = createEmptyRealEstateProperty(kind);
    editingId = prop.id;
    draft = { ...prop };
    isNew = true;
  }

  function openEdit(id: string) {
    const prop = $planStore.realEstate?.find((p) => p.id === id);
    if (!prop) return;
    isNew = false;
    editingId = id;
    draft = { ...prop };
  }

  function closeEdit() {
    editingId = null;
    draft = null;
  }

  function saveEdit() {
    if (!draft || !editingId) return;
    const saved = { ...draft };
    if (saved.kind === 'primaryResidence') saved.netIncomeAnnual = 0;
    planStore.update((plan) => ({
      ...plan,
      realEstate: isNew ? [...(plan.realEstate ?? []), saved] : (plan.realEstate ?? []).map((p) => (p.id === editingId ? saved : p)),
    }));
    closeEdit();
  }

  function removeProperty(id: string) {
    planStore.update((plan) => ({
      ...plan,
      realEstate: (plan.realEstate ?? []).filter((p) => p.id !== id),
    }));
    if (editingId === id) closeEdit();
  }

  function setMonthlyMortgage(raw: string) {
    if (!draft) return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return;
    draft.mortgagePaymentAnnual = n * 12;
    draft = draft;
  }

  function setMonthlyNoi(raw: string) {
    if (!draft) return;
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    draft.netIncomeAnnual = n * 12;
    draft = draft;
  }

  function onBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) closeEdit();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && editingId) closeEdit();
  }

  function kindLabel(kind: RealEstateKind): string {
    return kind === 'primaryResidence' ? 'Primary home' : 'Rental';
  }
</script>

<svelte:window on:keydown={onKeydown} />

<div class="space-y-6">
  <PlannerPanel
    title="Real Estate"
    description="Primary residence and rental properties. Mortgage, tax, and insurance reduce cash flow; rental net income can shorten your retirement runway. Home equity is illiquid by default (not counted in RAMP accessible assets unless you opt in)."
  >
    <div class="flex flex-wrap gap-2">
      <button type="button" class="btn-secondary" on:click={() => addProperty('primaryResidence')}>
        + Primary home
      </button>
      <button type="button" class="btn-secondary" on:click={() => addProperty('rental')}>
        + Rental property
      </button>
    </div>

    {#if properties.length === 0}
      <EmptyState
        title="No real estate yet"
        message="Optional — add a primary home and/or rentals if you want mortgage costs and rental income in projections and RAMP."
      />
    {:else}
      <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table class="min-w-full text-sm">
          <thead
            class="bg-gray-50 dark:bg-gray-800/80 text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            <tr>
              <th class="px-3 py-2.5 font-medium">Property</th>
              <th class="px-3 py-2.5 font-medium">Type</th>
              <th class="px-3 py-2.5 font-medium text-right">Value</th>
              <th class="px-3 py-2.5 font-medium text-right">Equity</th>
              <th class="px-3 py-2.5 font-medium text-right">Mortgage / yr</th>
              <th class="px-3 py-2.5 font-medium text-right">NOI / yr</th>
              <th class="px-3 py-2.5 font-medium"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {#each properties as prop (prop.id)}
              <tr
                class="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50/80 dark:hover:bg-gray-800/40 cursor-pointer transition-colors"
                on:click={() => openEdit(prop.id)}
              >
                <td class="px-3 py-2.5 font-medium text-gray-900 dark:text-white">
                  {prop.label}
                  {#if prop.countsTowardAccessibleAssets}
                    <span class="mt-0.5 block text-[11px] font-normal text-amber-600 dark:text-amber-400"
                      >Equity counts as accessible</span
                    >
                  {/if}
                </td>
                <td class="px-3 py-2.5 text-gray-600 dark:text-gray-400">{kindLabel(prop.kind)}</td>
                <td class="px-3 py-2.5 text-right tabular-nums">{money(prop.estimatedValue)}</td>
                <td class="px-3 py-2.5 text-right tabular-nums">{money(realEstateNetEquity(prop))}</td>
                <td class="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400">
                  {prop.mortgagePaymentAnnual > 0 ? money(prop.mortgagePaymentAnnual) : '—'}
                </td>
                <td class="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400">
                  {prop.kind === 'rental' ? money(prop.netIncomeAnnual) : '—'}
                </td>
                <td class="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    class="text-primary-600 dark:text-primary-400 hover:underline text-xs"
                    on:click|stopPropagation={() => openEdit(prop.id)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
          <tfoot>
            <tr class="border-t border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40">
              <td class="px-3 py-2.5 font-medium" colspan="2">Totals</td>
              <td class="px-3 py-2.5 text-right font-semibold tabular-nums">{money(totalValue)}</td>
              <td class="px-3 py-2.5 text-right font-semibold tabular-nums">{money(totalEquity)}</td>
              <td colspan="1"></td>
              <td class="px-3 py-2.5 text-right font-semibold tabular-nums"
                >{rentalNoi !== 0 ? money(rentalNoi) : ''}</td
              >
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    {/if}
  </PlannerPanel>
</div>

{#if draft}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60"
    role="presentation"
    on:click={onBackdrop}
  >
    <div
      class="max-h-[90dvh] overflow-y-auto w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl"
      use:dialogFocus={closeEdit}
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="re-edit-title"
    >
      <header
        class="flex items-start justify-between gap-3 border-b border-gray-100 dark:border-gray-800 px-5 py-4"
      >
        <div>
          <p class="text-xs uppercase tracking-wide text-primary-600 dark:text-primary-400">
            {kindLabel(draft.kind)}
          </p>
          <h3 id="re-edit-title" class="text-lg font-semibold text-gray-900 dark:text-white">
            Edit property
          </h3>
        </div>
        <button
          type="button"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
          aria-label="Close"
          on:click={closeEdit}
        >
          ×
        </button>
      </header>

      <div class="px-5 py-4 space-y-4">
        <label class="block text-sm">
          <span class="text-gray-600 dark:text-gray-400">Label</span>
          <input
            class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2"
            bind:value={draft.label}
          />
        </label>

        <div class="grid grid-cols-2 gap-3">
          <label class="block text-sm">
            <span class="text-gray-600 dark:text-gray-400">Estimated value ($)</span>
            <input
              type="number"
              min="0"
              step="1000"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2"
              bind:value={draft.estimatedValue}
            />
          </label>
          <label class="block text-sm">
            <span class="text-gray-600 dark:text-gray-400">Mortgage balance ($)</span>
            <input
              type="number"
              min="0"
              step="1000"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2"
              bind:value={draft.mortgageBalance}
            />
            <span class="mt-0.5 block text-[11px] text-gray-500"
              >Equity {money(realEstateNetEquity(draft))}</span
            >
          </label>
          <label class="block text-sm">
            <span class="text-gray-600 dark:text-gray-400">Mortgage payment / mo ($)</span>
            <input
              type="number"
              min="0"
              step="50"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2"
              value={(draft.mortgagePaymentAnnual || 0) / 12}
              on:change={(e) => setMonthlyMortgage(e.currentTarget.value)}
            />
            <span class="mt-0.5 block text-[11px] text-gray-500"
              >{money(draft.mortgagePaymentAnnual || 0)}/yr P&amp;I</span
            >
          </label>
          <label class="block text-sm">
            <span class="text-gray-600 dark:text-gray-400">Mortgage payoff age</span>
            <input
              type="number"
              min="0"
              max="120"
              step="1"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2"
              value={draft.mortgagePayoffAge ?? ''}
              placeholder="Optional"
              on:change={(e) => {
                if (!draft) return;
                const raw = e.currentTarget.value;
                if (raw === '') {
                  draft.mortgagePayoffAge = null;
                } else {
                  const n = Number(raw);
                  if (Number.isFinite(n)) draft.mortgagePayoffAge = n;
                }
                draft = draft;
              }}
            />
            <span class="mt-0.5 block text-[11px] text-gray-500"
              >Payments stop at this primary age</span
            >
          </label>
          <label class="block text-sm">
            <span class="text-gray-600 dark:text-gray-400">Property tax / yr ($)</span>
            <input
              type="number"
              min="0"
              step="100"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2"
              bind:value={draft.propertyTaxAnnual}
            />
          </label>
          <label class="block text-sm">
            <span class="text-gray-600 dark:text-gray-400">Insurance / yr ($)</span>
            <input
              type="number"
              min="0"
              step="100"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2"
              bind:value={draft.insuranceAnnual}
            />
          </label>
        </div>

        {#if draft.kind === 'rental'}
          <label class="block text-sm">
            <span class="text-gray-600 dark:text-gray-400">Net rental income / mo ($)</span>
            <input
              type="number"
              step="50"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2"
              value={(draft.netIncomeAnnual || 0) / 12}
              on:change={(e) => setMonthlyNoi(e.currentTarget.value)}
            />
            <span class="mt-0.5 block text-[11px] text-gray-500">
              {money(draft.netIncomeAnnual || 0)}/yr after operating costs (can be negative). Mortgage,
              tax, and insurance above are still counted separately as expenses.
            </span>
          </label>
        {/if}

        <label class="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            class="mt-1 rounded"
            bind:checked={draft.countsTowardAccessibleAssets}
          />
          <span>
            <span class="font-medium text-gray-900 dark:text-white"
              >Count equity toward RAMP accessible assets</span
            >
            <span class="block text-xs text-gray-500 mt-0.5">
              Off by default — home equity is not cash you can spend without selling, refinancing, or a
              HELOC. Only enable if you have a concrete plan to unlock it.
            </span>
          </span>
        </label>
      </div>

      <footer
        class="flex items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 px-5 py-4"
      >
        <button
          type="button"
          class="text-sm text-red-600 dark:text-red-400 hover:underline"
          on:click={() => removeProperty(draft.id)}
        >
          Remove property
        </button>
        <div class="flex gap-2">
          <button type="button" class="btn-secondary" on:click={closeEdit}>Cancel</button>
          <button type="button" class="btn-primary" on:click={saveEdit}>Save</button>
        </div>
      </footer>
    </div>
  </div>
{/if}
