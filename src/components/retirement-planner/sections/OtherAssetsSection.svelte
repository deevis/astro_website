<script lang="ts">
  import { dialogFocus } from '../lib/dialogFocus';
  import { planStore } from '../lib/planStore';
  import {
    OTHER_ASSET_CATEGORY_LABELS,
    createEmptyOtherPersonalAsset,
    type OtherAssetCategory,
    type OtherPersonalAsset,
  } from '../lib/types';
  import { money } from '../lib/cashflow';
  import PlannerPanel from '../PlannerPanel.svelte';
  import EmptyState from '../EmptyState.svelte';

  const categories = Object.keys(OTHER_ASSET_CATEGORY_LABELS) as OtherAssetCategory[];

  let editingId: string | null = null;
  let isNew = false;
  let draft: OtherPersonalAsset | null = null;

  $: assets = $planStore.otherAssets ?? [];
  $: totalValue = assets.reduce((s, a) => s + Math.max(0, a.estimatedValue), 0);
  $: totalCost = assets.reduce((s, a) => s + Math.max(0, a.annualCost), 0);

  $: editing =
    editingId != null ? assets.find((a) => a.id === editingId) ?? null : null;

  function addAsset(category: OtherAssetCategory = 'vehicle') {
    const asset = createEmptyOtherPersonalAsset(category);
    editingId = asset.id;
    draft = { ...asset };
    isNew = true;
  }

  function openEdit(id: string) {
    const asset = $planStore.otherAssets?.find((a) => a.id === id);
    if (!asset) return;
    isNew = false;
    editingId = id;
    draft = { ...asset };
  }

  function closeEdit() {
    editingId = null;
    draft = null;
  }

  function saveEdit() {
    if (!draft || !editingId) return;
    const saved = { ...draft };
    planStore.update((plan) => ({
      ...plan,
      otherAssets: isNew ? [...(plan.otherAssets ?? []), saved] : (plan.otherAssets ?? []).map((a) => (a.id === editingId ? saved : a)),
    }));
    closeEdit();
  }

  function removeAsset(id: string) {
    planStore.update((plan) => ({
      ...plan,
      otherAssets: (plan.otherAssets ?? []).filter((a) => a.id !== id),
    }));
    if (editingId === id) closeEdit();
  }

  function onBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) closeEdit();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && editingId) closeEdit();
  }
</script>

<svelte:window on:keydown={onKeydown} />

<div class="space-y-6">
  <PlannerPanel
    title="Other Assets"
    description="Vehicles, boats, art, and collectibles for Net Worth. These are not part of the investable portfolio unless you opt them into RAMP accessible assets. Annual costs (insurance, storage) reduce cash flow."
  >
    <div class="flex flex-wrap gap-2">
      {#each categories as cat}
        <button type="button" class="btn-secondary" on:click={() => addAsset(cat)}>
          + {OTHER_ASSET_CATEGORY_LABELS[cat]}
        </button>
      {/each}
    </div>

    {#if assets.length === 0}
      <EmptyState
        title="No other assets yet"
        message="Optional — add cars, boats, motorcycles, art, or collectibles to reflect Net Worth. Gold and silver belong under Assets (investable)."
      />
    {:else}
      <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table class="min-w-full text-sm">
          <thead
            class="bg-gray-50 dark:bg-gray-800/80 text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            <tr>
              <th class="px-3 py-2.5 font-medium">Asset</th>
              <th class="px-3 py-2.5 font-medium">Category</th>
              <th class="px-3 py-2.5 font-medium text-right">Value</th>
              <th class="px-3 py-2.5 font-medium text-right">Cost / yr</th>
              <th class="px-3 py-2.5 font-medium"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {#each assets as asset (asset.id)}
              <tr
                class="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50/80 dark:hover:bg-gray-800/40 cursor-pointer transition-colors"
                on:click={() => openEdit(asset.id)}
              >
                <td class="px-3 py-2.5 font-medium text-gray-900 dark:text-white">
                  {asset.label}
                  {#if asset.countsTowardAccessibleAssets}
                    <span class="mt-0.5 block text-[11px] font-normal text-amber-600 dark:text-amber-400"
                      >Counts as accessible</span
                    >
                  {/if}
                </td>
                <td class="px-3 py-2.5 text-gray-600 dark:text-gray-400"
                  >{OTHER_ASSET_CATEGORY_LABELS[asset.category]}</td
                >
                <td class="px-3 py-2.5 text-right tabular-nums">{money(asset.estimatedValue)}</td>
                <td class="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400">
                  {asset.annualCost > 0 ? money(asset.annualCost) : '—'}
                </td>
                <td class="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    class="text-primary-600 dark:text-primary-400 hover:underline text-xs"
                    on:click|stopPropagation={() => openEdit(asset.id)}
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
              <td class="px-3 py-2.5 text-right font-semibold tabular-nums"
                >{totalCost > 0 ? money(totalCost) : ''}</td
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
      class="max-h-[90dvh] overflow-y-auto w-full max-w-lg rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl"
      use:dialogFocus={closeEdit}
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="other-edit-title"
    >
      <header
        class="flex items-start justify-between gap-3 border-b border-gray-100 dark:border-gray-800 px-5 py-4"
      >
        <div>
          <p class="text-xs uppercase tracking-wide text-primary-600 dark:text-primary-400">
            {OTHER_ASSET_CATEGORY_LABELS[draft.category]}
          </p>
          <h3 id="other-edit-title" class="text-lg font-semibold text-gray-900 dark:text-white">
            Edit asset
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
        <label class="block text-sm">
          <span class="text-gray-600 dark:text-gray-400">Category</span>
          <select
            class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2"
            bind:value={draft.category}
          >
            {#each categories as cat}
              <option value={cat}>{OTHER_ASSET_CATEGORY_LABELS[cat]}</option>
            {/each}
          </select>
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="block text-sm">
            <span class="text-gray-600 dark:text-gray-400">Estimated value ($)</span>
            <input
              type="number"
              min="0"
              step="100"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2"
              bind:value={draft.estimatedValue}
            />
          </label>
          <label class="block text-sm">
            <span class="text-gray-600 dark:text-gray-400">Annual cost ($)</span>
            <input
              type="number"
              min="0"
              step="50"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2"
              bind:value={draft.annualCost}
            />
            <span class="mt-0.5 block text-[11px] text-gray-500"
              >Insurance, storage, maintenance</span
            >
          </label>
        </div>
        <label class="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            class="mt-1 rounded"
            bind:checked={draft.countsTowardAccessibleAssets}
          />
          <span>
            <span class="font-medium text-gray-900 dark:text-white"
              >Count toward RAMP accessible assets</span
            >
            <span class="block text-xs text-gray-500 mt-0.5">
              Off by default — only enable if you would actually sell this to fund early retirement.
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
          on:click={() => removeAsset(draft.id)}
        >
          Remove asset
        </button>
        <div class="flex gap-2">
          <button type="button" class="btn-secondary" on:click={closeEdit}>Cancel</button>
          <button type="button" class="btn-primary" on:click={saveEdit}>Save</button>
        </div>
      </footer>
    </div>
  </div>
{/if}
