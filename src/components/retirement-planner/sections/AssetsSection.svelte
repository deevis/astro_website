<script lang="ts">
  import { planStore } from '../lib/planStore';
  import { dialogFocus } from '../lib/dialogFocus';
  import {
    ACCOUNT_TYPE_DEFAULT_RETURNS,
    ACCOUNT_TYPE_LABELS,
    ACCOUNT_UNIT_LABELS,
    formatGoldGrams,
    parseGoldAmountToTroyOz,
    troyOzToGrams,
    newId,
    type Account,
    type AccountOwner,
    type AccountType,
  } from '../lib/types';
  import { money } from '../lib/cashflow';
  import {
    fetchBitcoinSpotUsd,
    fetchGoldSpotUsd,
    fetchSilverSpotUsd,
  } from '../lib/bitcoinSpot';
  import PlannerPanel from '../PlannerPanel.svelte';
  import EmptyState from '../EmptyState.svelte';

  const addableTypes: AccountType[] = [
    'traditionalIra',
    'rothIra',
    'traditional401k',
    'roth401k',
    'brokerage',
    'bitcoin',
    'gold',
    'silver',
    'crypto',
    'hysa',
    'cd',
    'bond',
  ];

  /** Types where people think in monthly contributions */
  const monthlyContribTypes: AccountType[] = ['hysa', 'traditional401k', 'roth401k'];
  const unitPricedTypes: AccountType[] = ['bitcoin', 'gold', 'silver'];

  let editingId: string | null = null;
  let draft: Account | null = null;
  let spotPriceLoading = false;
  let spotPriceError = '';
  /** Gold amount field (grams text like "67g"); kept separate so suffix typing works. */
  let goldAmountInput = '';
  let monthlyContributionInput = '';
  let monthlyMatchInput = '';
  let isNewAccount = false;
  let spotRequest = 0;
  let editForm: HTMLFormElement;
  let editError = '';

  $: editingAccount =
    editingId != null ? $planStore.accounts.find((a) => a.id === editingId) ?? null : null;

  function typeLabel(type: AccountType): string {
    return ACCOUNT_TYPE_LABELS[type] ?? type;
  }

  function ownerLabel(owner: AccountOwner): string {
    if (owner === 'primary') return 'Primary';
    if (owner === 'spouse') return 'Spouse';
    return 'Joint';
  }

  function usesMonthlyContrib(type: AccountType): boolean {
    return monthlyContribTypes.includes(type);
  }

  function isUnitPriced(type: AccountType): boolean {
    return unitPricedTypes.includes(type);
  }

  function isTaxableAlt(type: AccountType): boolean {
    return type === 'bitcoin' || type === 'crypto' || type === 'gold' || type === 'silver';
  }

  function unitLabel(type: AccountType): string {
    return ACCOUNT_UNIT_LABELS[type] ?? 'units';
  }

  function addAccount(type: AccountType) {
    const account: Account = {
      id: newId('acct'),
      type,
      label: ACCOUNT_TYPE_LABELS[type],
      owner: 'primary',
      balance: 0,
      annualContribution: 0,
      expectedReturn: ACCOUNT_TYPE_DEFAULT_RETURNS[type],
      ...(type === 'traditional401k' || type === 'roth401k'
        ? { employerMatchAnnual: 0 }
        : {}),
    };
    editingId = account.id;
    draft = account;
    isNewAccount = true;
    editError = '';
    goldAmountInput = '';
    monthlyContributionInput = usesMonthlyContrib(type) ? '0' : '';
    monthlyMatchInput = type === 'traditional401k' || type === 'roth401k' ? '0' : '';
  }

  function openEdit(id: string) {
    const acct = $planStore.accounts.find((a) => a.id === id);
    if (!acct) return;
    editingId = id;
    isNewAccount = false;
    editError = '';
    draft = { ...acct };
    spotPriceError = '';
    goldAmountInput =
      acct.type === 'gold' && acct.assetUnits != null && acct.assetUnits > 0
        ? formatGoldGrams(acct.assetUnits)
        : '';
    monthlyContributionInput = usesMonthlyContrib(acct.type)
      ? formatMonthlyFromAnnual(acct.annualContribution)
      : '';
    monthlyMatchInput =
      acct.type === 'traditional401k' || acct.type === 'roth401k'
        ? formatMonthlyFromAnnual(acct.employerMatchAnnual ?? 0)
        : '';
  }

  function closeEdit() {
    spotRequest++;
    spotPriceLoading = false;
    editingId = null;
    draft = null;
    spotPriceError = '';
    goldAmountInput = '';
    monthlyContributionInput = '';
    monthlyMatchInput = '';
  }

  function saveEdit() {
    if (!draft || !editingId) return;
    if (!editForm.reportValidity()) return;
    if (draft.type === 'gold' && goldAmountInput.trim() && parseGoldAmountToTroyOz(goldAmountInput) == null) {
      editError = 'Enter a gold amount in grams (67g) or troy ounces (2 oz t).';
      return;
    }
    const saved = { ...draft };
    if (usesMonthlyContrib(saved.type)) {
      saved.annualContribution = annualFromMonthly(monthlyContributionInput);
    }
    if (saved.type === 'traditional401k' || saved.type === 'roth401k') {
      saved.employerMatchAnnual = annualFromMonthly(monthlyMatchInput);
    }
    if (isUnitPriced(saved.type)) {
      syncUnitBalance(saved);
    }
    if (saved.type !== 'traditional401k' && saved.type !== 'roth401k') {
      delete saved.employerMatchAnnual;
    }
    planStore.update((plan) => ({
      ...plan,
      accounts: isNewAccount ? [...plan.accounts, saved] : plan.accounts.map((a) => (a.id === editingId ? saved : a)),
    }));
    closeEdit();
  }

  function syncUnitBalance(acct: Account) {
    if (acct.assetUnits != null && acct.assetUnits >= 0 && acct.spotPriceUsd != null && acct.spotPriceUsd > 0) {
      acct.balance = acct.assetUnits * acct.spotPriceUsd;
    } else if (
      acct.spotPriceUsd != null &&
      acct.spotPriceUsd > 0 &&
      acct.balance > 0 &&
      acct.assetUnits == null
    ) {
      acct.assetUnits = acct.balance / acct.spotPriceUsd;
    }
  }

  async function fetchLiveSpotPrice() {
    if (!draft || !isUnitPriced(draft.type)) return;
    spotPriceLoading = true;
    spotPriceError = '';
    const requestId = ++spotRequest;
    const accountId = draft.id;
    try {
      let price: number;
      if (draft.type === 'bitcoin') price = await fetchBitcoinSpotUsd();
      else if (draft.type === 'gold') price = await fetchGoldSpotUsd();
      else price = await fetchSilverSpotUsd();
      if (requestId === spotRequest && draft?.id === accountId) applySpotPrice(price);
    } catch (e) {
      if (requestId === spotRequest) spotPriceError = e instanceof Error ? e.message : 'Could not fetch price';
    } finally {
      if (requestId === spotRequest) spotPriceLoading = false;
    }
  }

  function applySpotPrice(price: number) {
    if (!draft) return;
    draft.spotPriceUsd = price;
    if (draft.assetUnits != null && draft.assetUnits >= 0) {
      draft.balance = draft.assetUnits * price;
    } else if (draft.balance > 0) {
      draft.assetUnits = draft.balance / price;
    }
    draft = draft;
  }

  function setBalance(raw: string) {
    if (!draft) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) return;
    draft.balance = amount;
    if (isUnitPriced(draft.type) && draft.spotPriceUsd != null && draft.spotPriceUsd > 0) {
      draft.assetUnits = amount / draft.spotPriceUsd;
      if (draft.type === 'gold') goldAmountInput = `${troyOzToGrams(draft.assetUnits)}g`;
    }
  }

  function setAssetUnits(raw: string) {
    if (!draft) return;
    if (draft.type === 'gold') {
      goldAmountInput = raw;
      if (!raw.trim()) {
        draft.assetUnits = undefined;
        draft = draft;
        return;
      }
      const oz = parseGoldAmountToTroyOz(raw);
      if (oz == null) return;
      draft.assetUnits = oz;
      if (draft.spotPriceUsd != null && draft.spotPriceUsd > 0) {
        draft.balance = oz * draft.spotPriceUsd;
      }
      draft = draft;
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return;
    draft.assetUnits = n;
    if (draft.spotPriceUsd != null && draft.spotPriceUsd > 0) {
      draft.balance = n * draft.spotPriceUsd;
    }
    draft = draft;
  }

  function amountDisplayValue(type: AccountType): string {
    if (type === 'gold') return goldAmountInput;
    return draft?.assetUnits != null ? String(draft.assetUnits) : '';
  }

  function amountFieldLabel(type: AccountType): string {
    if (type === 'gold') return 'Amount (grams)';
    return `Amount (${unitLabel(type)})`;
  }

  function spotPriceLabel(type: AccountType): string {
    if (type === 'gold') return 'Spot price ($ / oz t)';
    return `Spot price ($ / ${unitLabel(type)})`;
  }

  function amountPlaceholder(type: AccountType): string {
    if (type === 'bitcoin') return 'e.g. 2.5';
    if (type === 'gold') return 'e.g. 67g';
    return 'e.g. 10';
  }

  function amountHelp(type: AccountType): string {
    if (type === 'gold') {
      const g =
        draft?.assetUnits != null && draft.assetUnits > 0
          ? troyOzToGrams(draft.assetUnits)
          : null;
      const ozNote =
        g != null ? ` ≈ ${draft!.assetUnits!.toFixed(3)} oz t` : '';
      return `Enter grams (67 or 67g). Spot is per troy ounce; balance = oz × price (${money(draft?.balance ?? 0)})${ozNote}.`;
    }
    return `Balance = ${unitLabel(type)} × price (${money(draft?.balance ?? 0)}). Enter amount and price so projections can track units when harvesting into HYSA.`;
  }

  function setSpotPrice(raw: string) {
    if (!draft) return;
    spotRequest++;
    spotPriceLoading = false;
    spotPriceError = '';
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return;
    draft.spotPriceUsd = n;
    if (draft.assetUnits != null && draft.assetUnits > 0) {
      draft.balance = draft.assetUnits * n;
    } else if (draft.balance > 0) {
      draft.assetUnits = draft.balance / n;
    }
    draft = draft;
  }

  function formatMonthlyFromAnnual(annual: number): string {
    if (!annual) return '0';
    const monthly = Math.round((annual / 12) * 100) / 100;
    return String(monthly);
  }

  function annualFromMonthly(raw: string): number {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n * 12 * 100) / 100;
  }

  function setMonthlyContribution(raw: string) {
    monthlyContributionInput = raw;
    if (!draft) return;
    draft = { ...draft, annualContribution: annualFromMonthly(raw) };
  }

  function setMonthlyEmployerMatch(raw: string) {
    monthlyMatchInput = raw;
    if (!draft) return;
    draft = { ...draft, employerMatchAnnual: annualFromMonthly(raw) };
  }

  function removeAccount(id: string) {
    planStore.update((plan) => ({
      ...plan,
      accounts: plan.accounts.filter((a) => a.id !== id),
    }));
    if (editingId === id) closeEdit();
  }

  function onBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) closeEdit();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && editingId) closeEdit();
  }

  function contribDisplay(account: Account): string {
    const employee = account.annualContribution || 0;
    const match = account.employerMatchAnnual || 0;
    if (match > 0) return `${money(employee)} + ${money(match)} match`;
    return money(employee);
  }

  $: totalBalance = $planStore.accounts.reduce((s, a) => s + (a.balance || 0), 0);
</script>

<svelte:window on:keydown={onKeydown} />

<div class="space-y-6">
  <PlannerPanel
    title="Assets"
    description="Retirement, taxable, Bitcoin, precious metals, crypto, and cash holdings. Set balance, monthly contributions, and (for 401k) employer match on each account — they stop at retirement."
  >
    <div class="flex flex-wrap gap-2">
      {#each addableTypes as type}
        <button type="button" class="btn-secondary" on:click={() => addAccount(type)}>
          + {ACCOUNT_TYPE_LABELS[type]}
        </button>
      {/each}
    </div>

    {#if $planStore.accounts.length === 0}
      <EmptyState
        title="No accounts yet"
        message="Add your retirement, taxable, Bitcoin, gold/silver, and cash accounts with real balances. Contributions and employer match live on each account."
      />
    {:else}
      <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table class="min-w-full text-sm">
          <thead
            class="bg-gray-50 dark:bg-gray-800/80 text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            <tr>
              <th class="px-3 py-2.5 font-medium">Account</th>
              <th class="px-3 py-2.5 font-medium">Type</th>
              <th class="px-3 py-2.5 font-medium">Owner</th>
              <th class="px-3 py-2.5 font-medium text-right">Balance</th>
              <th class="px-3 py-2.5 font-medium text-right">Contribute / yr</th>
              <th class="px-3 py-2.5 font-medium text-right">Return</th>
              <th class="px-3 py-2.5 font-medium"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {#each $planStore.accounts as account (account.id)}
              <tr
                class="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50/80 dark:hover:bg-gray-800/40 cursor-pointer transition-colors"
                on:click={() => openEdit(account.id)}
              >
                <td class="px-3 py-2.5 font-medium text-gray-900 dark:text-white">
                  {account.label}
                  {#if isUnitPriced(account.type) && account.assetUnits != null}
                    <span class="mt-0.5 block text-[11px] font-normal text-gray-500">
                      {#if account.type === 'bitcoin'}
                        {account.assetUnits.toFixed(4)} BTC
                      {:else if account.type === 'gold'}
                        {formatGoldGrams(account.assetUnits)}
                      {:else}
                        {account.assetUnits.toFixed(2)} {unitLabel(account.type)}
                      {/if}
                      {#if account.spotPriceUsd}
                        @ {money(account.spotPriceUsd)}{account.type === 'gold' ? '/oz' : ''}
                      {/if}
                    </span>
                  {/if}
                </td>
                <td class="px-3 py-2.5 text-gray-600 dark:text-gray-400">{typeLabel(account.type)}</td>
                <td class="px-3 py-2.5 text-gray-600 dark:text-gray-400">{ownerLabel(account.owner)}</td>
                <td class="px-3 py-2.5 text-right tabular-nums text-gray-900 dark:text-white">
                  {money(account.balance)}
                </td>
                <td class="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400">
                  {contribDisplay(account)}
                </td>
                <td class="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400">
                  {account.type === 'bitcoin' ? 'Assumptions' : (account.expectedReturn * 100).toFixed(1) + '%'}
                </td>
                <td class="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    class="text-primary-600 dark:text-primary-400 hover:underline text-xs"
                    on:click|stopPropagation={() => openEdit(account.id)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
          <tfoot>
            <tr class="border-t border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40">
              <td class="px-3 py-2.5 font-medium text-gray-900 dark:text-white" colspan="3">Total</td>
              <td class="px-3 py-2.5 text-right font-semibold tabular-nums text-gray-900 dark:text-white">
                {money(totalBalance)}
              </td>
              <td colspan="3"></td>
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
    <div role="dialog" aria-modal="true" aria-labelledby="asset-edit-title" tabindex="-1" use:dialogFocus={closeEdit}
      class="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl">
    <form
      bind:this={editForm}
      on:submit|preventDefault={saveEdit}
    >
      <header
        class="flex items-start justify-between gap-3 border-b border-gray-100 dark:border-gray-800 px-5 py-4"
      >
        <div>
          <p class="text-xs uppercase tracking-wide text-primary-600 dark:text-primary-400">
            {typeLabel(draft.type)}
          </p>
          <h3 id="asset-edit-title" class="text-lg font-semibold text-gray-900 dark:text-white">
            {isNewAccount ? 'Add account' : 'Edit account'}
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
            <span class="text-gray-600 dark:text-gray-400">Balance ($)</span>
            <input
              type="number"
              min="0"
              step="any"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2"
              required
              value={draft.balance}
              on:input={(e) => setBalance(e.currentTarget.value)}
            />
          </label>
          {#if usesMonthlyContrib(draft.type)}
            <label class="block text-sm">
              <span class="text-gray-600 dark:text-gray-400">Your contribution / mo ($)</span>
              <input
                type="number"
                min="0"
                step="any"
                inputmode="decimal"
                class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2"
                value={monthlyContributionInput}
                on:input={(e) => setMonthlyContribution(e.currentTarget.value)}
              />
              <span class="mt-0.5 block text-[11px] text-gray-500"
                >{money(draft.annualContribution || 0)}/yr while working</span
              >
            </label>
          {:else}
            <label class="block text-sm">
              <span class="text-gray-600 dark:text-gray-400">Annual contribution ($)</span>
              <input
                type="number"
                min="0"
                step="100"
                class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2"
                bind:value={draft.annualContribution}
              />
            </label>
          {/if}
          <label class="block text-sm">
            <span class="text-gray-600 dark:text-gray-400">Expected return (%)</span>
            <input
              type="number"
              min="-100"
              max="100"
              step="0.1"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2"
              value={(draft.expectedReturn * 100).toFixed(1)}
              disabled={draft.type === 'bitcoin'}
              on:input={(e) => {
                if (!draft) return;
                const n = Number(e.currentTarget.value) / 100;
                if (Number.isFinite(n)) draft.expectedReturn = n;
              }}
            />
            {#if draft.type === 'bitcoin'}<span class="mt-1 block text-xs text-gray-500">Bitcoin uses the price path and return in Assumptions.</span>{/if}
          </label>
          <label class="block text-sm">
            <span class="text-gray-600 dark:text-gray-400">Owner</span>
            <select
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2"
              bind:value={draft.owner}
            >
              <option value="primary">Primary</option>
              {#if $planStore.filingStatus === 'married'}
                <option value="spouse">Spouse</option>
                <option value="joint">Joint</option>
              {/if}
            </select>
          </label>
        </div>

        {#if draft.type === 'traditional401k' || draft.type === 'roth401k'}
          <label class="block text-sm">
            <span class="text-gray-600 dark:text-gray-400">Employer match / mo ($)</span>
            <input
              type="number"
              min="0"
              step="any"
              inputmode="decimal"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2"
              value={monthlyMatchInput}
              on:input={(e) => setMonthlyEmployerMatch(e.currentTarget.value)}
            />
            <span class="mt-0.5 block text-[11px] text-gray-500">
              {money(draft.employerMatchAnnual ?? 0)}/yr added while working (grows with this account)
            </span>
          </label>
        {/if}

        {#if draft.type === 'rothIra' || draft.type === 'roth401k'}
          <label class="block text-sm">
            <span class="text-gray-600 dark:text-gray-400">Contribution basis ($)</span>
            <input
              type="number"
              min="0"
              step="100"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2"
              value={draft.contributionBasis ?? ''}
              placeholder="Leave blank to estimate"
              on:input={(e) => {
                if (!draft) return;
                const raw = e.currentTarget.value;
                if (raw === '') {
                  delete draft.contributionBasis;
                  draft = draft;
                  return;
                }
                const n = Number(raw);
                if (Number.isFinite(n)) draft.contributionBasis = Math.max(0, n);
              }}
            />
            <span class="mt-0.5 block text-[11px] text-gray-500">
              Penalty-free withdrawals before 59½; used by RAMP accessible-assets check.
            </span>
          </label>
        {/if}

        {#if isUnitPriced(draft.type)}
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="block text-sm">
              <span class="text-gray-600 dark:text-gray-400">{amountFieldLabel(draft.type)}</span>
              {#if draft.type === 'gold'}
                <input
                  type="text"
                  inputmode="decimal"
                  class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2"
                  value={goldAmountInput}
                  placeholder={amountPlaceholder(draft.type)}
                  on:input={(e) => setAssetUnits(e.currentTarget.value)}
                />
              {:else}
                <input
                  type="number"
                  min="0"
                  step="any"
                  class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2"
                  value={amountDisplayValue(draft.type)}
                  placeholder={amountPlaceholder(draft.type)}
                  on:input={(e) => setAssetUnits(e.currentTarget.value)}
                />
              {/if}
            </label>
            <label class="block text-sm">
              <span class="text-gray-600 dark:text-gray-400">{spotPriceLabel(draft.type)}</span>
              <div class="mt-1 flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  class="w-full min-w-0 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2"
                  value={draft.spotPriceUsd ?? ''}
                  placeholder="USD"
                  on:input={(e) => setSpotPrice(e.currentTarget.value)}
                />
                <button
                  type="button"
                  class="btn-secondary shrink-0 whitespace-nowrap"
                  disabled={spotPriceLoading}
                  aria-label="Fetch live spot price"
                  on:click={fetchLiveSpotPrice}
                >
                  {spotPriceLoading ? '…' : 'Live'}
                </button>
              </div>
            </label>
          </div>
          {#if spotPriceError}
            <p class="text-xs text-red-600 dark:text-red-400">{spotPriceError}</p>
          {/if}
          <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            {amountHelp(draft.type)}
          </p>
        {/if}

        {#if isTaxableAlt(draft.type) || draft.type === 'brokerage'}
          <label class="block text-sm">
            <span class="text-gray-600 dark:text-gray-400">Total cost basis ($)</span>
            <input
              type="number"
              min="0"
              step="100"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2"
              value={draft.costBasisUsd ?? ''}
              placeholder="Original purchase cost"
              on:input={(e) => {
                if (!draft) return;
                const raw = e.currentTarget.value;
                if (raw === '') {
                  delete draft.costBasisUsd;
                  draft = draft;
                  return;
                }
                const n = Number(raw);
                if (Number.isFinite(n)) draft.costBasisUsd = Math.max(0, n);
                draft = draft;
              }}
            />
            <span class="mt-0.5 block text-[11px] text-gray-500">
              Estimates federal CG tax on BTC/crypto and metals sales (LTCG for BTC/crypto; collectibles rate
              for gold/silver). Leave blank to assume $0 basis.
              {#if draft.assetUnits != null && draft.assetUnits > 0 && draft.costBasisUsd != null && draft.costBasisUsd > 0}
                ≈ {money(draft.costBasisUsd / draft.assetUnits)} per unit.
              {/if}
            </span>
          </label>
        {/if}
      </div>

      {#if editError}<p role="alert" class="px-5 text-sm text-red-600">{editError}</p>{/if}
      <footer
        class="flex items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 px-5 py-4"
      >
        {#if !isNewAccount}<button
          type="button"
          class="text-sm text-red-600 dark:text-red-400 hover:underline"
          on:click={() => removeAccount(draft.id)}
        >
          Remove account
        </button>{/if}
        <div class="flex gap-2">
          <button type="button" class="btn-secondary" on:click={closeEdit}>Cancel</button>
          <button type="submit" class="btn-primary">Save</button>
        </div>
      </footer>
    </form>
    </div>
  </div>
{/if}
