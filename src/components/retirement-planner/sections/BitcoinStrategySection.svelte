<script lang="ts">
  import { planStore } from '../lib/planStore';
  import {
    BITCOIN_SELL_POLICY_LABELS,
    BITCOIN_TRIM_WINDOW_LABELS,
    allocationTrimEnabled,
    type BitcoinSellPolicy,
    type BitcoinTrimWindow,
  } from '../lib/types';
  import {
    BITCOIN_PRICING_MODEL_LABELS,
    createDefaultBitcoinAmalgamMix,
    resolveAmalgamMix,
    scaledBitcoinModelPriceUsd,
    calendarYearToModelDate,
    type BitcoinAmalgamModelId,
    type BitcoinPricingModelId,
  } from '../lib/bitcoinPricingModels';
  import { money } from '../lib/cashflow';
  import PlannerPanel from '../PlannerPanel.svelte';

  const btcModelIds = Object.keys(BITCOIN_PRICING_MODEL_LABELS) as BitcoinPricingModelId[];
  const sellPolicies = Object.keys(BITCOIN_SELL_POLICY_LABELS) as BitcoinSellPolicy[];
  const trimWindows = Object.keys(BITCOIN_TRIM_WINDOW_LABELS) as BitcoinTrimWindow[];

  const inputClass =
    'mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2';

  $: strategy = $planStore.bitcoinStrategy;
  $: showAth = strategy.sellPolicy !== 'allocationTrim';
  $: showTrim = allocationTrimEnabled($planStore);
  $: btcPricingModel = $planStore.assumptions.bitcoinPricingModel ?? 'amalgam';
  $: amalgamMix = resolveAmalgamMix($planStore.assumptions.bitcoinAmalgamMix);
  $: amalgamWeightSum = amalgamMix.reduce(
    (sum, row) => sum + (row.enabled && row.weight > 0 ? row.weight : 0),
    0
  );
  $: btcSpot =
    $planStore.accounts.find((a) => a.type === 'bitcoin' && (a.spotPriceUsd ?? 0) > 0)?.spotPriceUsd ?? 0;
  $: btcPreview = [1, 5, 10].map((years) => ({
    years,
    price:
      btcPricingModel === 'expectedReturn'
        ? btcSpot * (1 + $planStore.assumptions.bitcoinReturn) ** years
        : scaledBitcoinModelPriceUsd(
            btcPricingModel,
            calendarYearToModelDate(new Date().getFullYear() + years),
            btcSpot,
            calendarYearToModelDate(new Date().getFullYear()),
            amalgamMix
          ),
  }));

  function setBitcoinPricingModel(value: string) {
    const model = value as BitcoinPricingModelId;
    if (!btcModelIds.includes(model)) return;
    planStore.update((plan) => ({
      ...plan,
      assumptions: { ...plan.assumptions, bitcoinPricingModel: model },
    }));
  }

  function writeAmalgamMix(mix: typeof amalgamMix) {
    planStore.update((plan) => ({
      ...plan,
      assumptions: { ...plan.assumptions, bitcoinAmalgamMix: resolveAmalgamMix(mix) },
    }));
  }

  function toggleAmalgamModel(id: BitcoinAmalgamModelId, on: boolean) {
    const enabledCount = amalgamMix.filter((row) => row.enabled && row.weight > 0).length;
    if (!on && enabledCount <= 1) return;
    writeAmalgamMix(amalgamMix.map((row) => (row.id === id ? { ...row, enabled: on } : row)));
  }

  function setAmalgamWeight(id: BitcoinAmalgamModelId, display: string) {
    const n = Number(display);
    if (!Number.isFinite(n)) return;
    writeAmalgamMix(
      amalgamMix.map((row) =>
        row.id === id ? { ...row, weight: Math.min(99, Math.max(0, n)) } : row
      )
    );
  }

  function resetAmalgamMix() {
    writeAmalgamMix(createDefaultBitcoinAmalgamMix());
  }

  function setAssumptionPct(key: 'bitcoinReturn' | 'bitcoinVolatility', display: string) {
    const n = Number(display) / 100;
    if (!Number.isFinite(n)) return;
    planStore.update((plan) => ({
      ...plan,
      assumptions: { ...plan.assumptions, [key]: n },
    }));
  }

  function setSellPolicy(policy: BitcoinSellPolicy) {
    planStore.update((plan) => ({
      ...plan,
      bitcoinStrategy: { ...plan.bitcoinStrategy, sellPolicy: policy },
      taxStrategy: {
        ...plan.taxStrategy,
        athHarvestEnabled: policy === 'allocationTrim' ? plan.taxStrategy.athHarvestEnabled : true,
      },
    }));
  }

  function setStrategyPct(
    key: 'maxAltShareOfNonAlt' | 'trimMaxSleeveFraction',
    display: string
  ) {
    const n = Number(display) / 100;
    if (!Number.isFinite(n)) return;
    const cap = key === 'maxAltShareOfNonAlt' ? 2 : 1;
    planStore.update((plan) => ({
      ...plan,
      bitcoinStrategy: {
        ...plan.bitcoinStrategy,
        [key]: Math.min(cap, Math.max(0, n)),
      },
    }));
  }

  function setTrimCashYears(display: string) {
    const n = Number(display);
    if (!Number.isFinite(n)) return;
    planStore.update((plan) => ({
      ...plan,
      bitcoinStrategy: {
        ...plan.bitcoinStrategy,
        trimWhenCashBelowYears: Math.min(10, Math.max(0, n)),
      },
    }));
  }

  function setAthHarvestPct(
    key: 'athHarvestMaxSleeveFraction' | 'athHarvestNearAthFraction',
    display: string
  ) {
    const n = Number(display) / 100;
    if (!Number.isFinite(n)) return;
    planStore.update((plan) => ({
      ...plan,
      taxStrategy: {
        ...plan.taxStrategy,
        [key]: Math.min(1, Math.max(0, n)),
      },
    }));
  }

  function setAthBufferYears(display: string) {
    const n = Number(display);
    if (!Number.isFinite(n)) return;
    planStore.update((plan) => ({
      ...plan,
      taxStrategy: {
        ...plan.taxStrategy,
        athHarvestBufferYears: Math.min(10, Math.max(0, n)),
      },
    }));
  }

  function setBitcoinHistoricalAth(display: string) {
    const n = Number(display.replace(/,/g, ''));
    if (!Number.isFinite(n) || n < 0) return;
    planStore.update((plan) => ({
      ...plan,
      assumptions: { ...plan.assumptions, bitcoinHistoricalAthUsd: n },
    }));
  }
</script>

<div class="space-y-6">
  <PlannerPanel
    title="Price path"
    description="How projected Bitcoin prices evolve on the deterministic path and in Monte Carlo. Enter a spot price on the Bitcoin account in Assets so unit counts stay in sync."
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <label class="block text-sm sm:col-span-2">
        <span class="text-gray-600 dark:text-gray-400">Bitcoin price path</span>
        <select
          class={inputClass}
          value={btcPricingModel}
          on:change={(e) => setBitcoinPricingModel(e.currentTarget.value)}
        >
          {#each btcModelIds as id}
            <option value={id}>{BITCOIN_PRICING_MODEL_LABELS[id]}</option>
          {/each}
        </select>
        <span class="mt-1 block text-xs text-gray-500">
          {#if btcPricingModel === 'expectedReturn'}
            Spot grows at the Bitcoin return below. Monte Carlo adds the configured volatility without
            halving-cycle shifts. The current calendar year is a stub: only the remaining months are
            applied to today’s spot.
          {:else if btcPricingModel === 'amalgam'}
            Weighted average of the models checked below. Weights are relative — Rainbow at 2 and
            Halving at 1 means Rainbow is two-thirds of the mix. Deterministic projection uses this
            curve; Monte Carlo uses halving-cycle bear/bull phases instead. The current calendar year
            is a stub: only the remaining months are applied to today’s spot.
          {:else}
            Projected spot follows the {BITCOIN_PRICING_MODEL_LABELS[btcPricingModel]} curve on the
            deterministic path. Monte Carlo uses halving-cycle phases (ATH formation from ~44w
            post-halving, peak ~74w; bear to ~74w pre-next-halving) with crypto amplifying Bitcoin.
            The current calendar year is a stub: only the remaining months are applied to today’s spot.
          {/if}
        </span>
      </label>
      {#if btcPricingModel === 'amalgam'}
        <div class="sm:col-span-2 space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Models in the mix</h3>
            <button type="button" class="btn-secondary text-xs" on:click={resetAmalgamMix}>
              Equal-weight all 6
            </button>
          </div>
          <div class="grid gap-2">
            {#each amalgamMix as row (row.id)}
              {@const share =
                row.enabled && row.weight > 0 && amalgamWeightSum > 0
                  ? (row.weight / amalgamWeightSum) * 100
                  : 0}
              <div class="flex flex-wrap items-center gap-3 text-sm">
                <label class="flex min-w-[12rem] flex-1 items-center gap-2 text-gray-800 dark:text-gray-200">
                  <input
                    type="checkbox"
                    class="rounded"
                    checked={row.enabled}
                    on:change={(e) => toggleAmalgamModel(row.id, e.currentTarget.checked)}
                  />
                  <span>{BITCOIN_PRICING_MODEL_LABELS[row.id]}</span>
                </label>
                <label class="flex items-center gap-2 text-xs text-gray-500">
                  <span>Weight</span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    step="0.1"
                    class="{inputClass} mt-0 w-20"
                    disabled={!row.enabled}
                    value={row.weight}
                    on:input={(e) => setAmalgamWeight(row.id, e.currentTarget.value)}
                  />
                </label>
                <span class="w-14 text-right text-xs tabular-nums text-gray-500"
                  >{row.enabled ? `${share.toFixed(0)}%` : 'off'}</span
                >
              </div>
            {/each}
          </div>
        </div>
      {/if}
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Bitcoin return (%)</span>
        <input
          type="number"
          step="0.1"
          class={inputClass}
          value={(($planStore.assumptions.bitcoinReturn ?? 0.12) * 100).toFixed(1)}
          on:input={(e) => setAssumptionPct('bitcoinReturn', e.currentTarget.value)}
        />
        <span class="mt-1 block text-xs text-gray-500"
          >Used for the deterministic path when “Fixed return” is selected; anchors MC halving-cycle
          sampling. Crypto in MC amplifies Bitcoin (~1.45×) with up to −80% calendar years.</span
        >
      </label>
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Bitcoin volatility (%)</span>
        <input
          type="number"
          step="0.1"
          class={inputClass}
          value={(($planStore.assumptions.bitcoinVolatility ?? 0.35) * 100).toFixed(1)}
          on:input={(e) => setAssumptionPct('bitcoinVolatility', e.currentTarget.value)}
        />
        <span class="mt-1 block text-xs text-gray-500">Lower than altcoins; low equity beta</span>
      </label>
      <label class="block text-sm sm:col-span-2">
        <span class="text-gray-600 dark:text-gray-400">Bitcoin historical all-time high ($)</span>
        <input
          type="number"
          min="0"
          step="1000"
          class="{inputClass} max-w-xs"
          value={$planStore.assumptions.bitcoinHistoricalAthUsd ?? 126000}
          on:input={(e) => setBitcoinHistoricalAth(e.currentTarget.value)}
        />
        <span class="mt-1 block text-xs text-gray-500"
          >Starting peak for near-ATH harvest. Update this when the market makes a new high.</span
        >
      </label>
    </div>
    {#if btcSpot > 0}
      <div class="rounded-lg border border-amber-200 dark:border-amber-800 p-4 space-y-3">
        <h3 class="font-semibold text-sm">Bitcoin future-price preview</h3>
        <p class="text-xs text-gray-500">
          Starts at your entered {money(btcSpot)} per BTC. These model scenarios can imply extreme
          growth; Monte Carlo uses separate bounded cycle returns for model paths.
        </p>
        <div class="grid grid-cols-3 gap-3">
          {#each btcPreview as point}
            <div>
              <p class="text-xs text-gray-500">In {point.years} {point.years === 1 ? 'year' : 'years'}</p>
              <p class="font-semibold break-words">{point.price == null ? '—' : money(point.price)}</p>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </PlannerPanel>

  <PlannerPanel
    title="Sell playbook"
    description="Choose whether Bitcoin (and optional other crypto) waits for a near-ATH refill, clips itself when the sleeve or HYSA gets out of balance, or both. Saved plans keep near-ATH harvest until you change this."
  >
    <fieldset class="space-y-3">
      <legend class="text-sm font-medium text-gray-900 dark:text-white">Playbook</legend>
      {#each sellPolicies as policy}
        <label
          class="flex items-start gap-3 rounded-lg border p-3 cursor-pointer {strategy.sellPolicy === policy
            ? 'border-primary-400 bg-primary-50/60 dark:border-primary-700 dark:bg-primary-950/30'
            : 'border-gray-200 dark:border-gray-700'}"
        >
          <input
            type="radio"
            class="mt-1"
            name="bitcoin-sell-policy"
            value={policy}
            checked={strategy.sellPolicy === policy}
            on:change={() => setSellPolicy(policy)}
          />
          <span>
            <span class="block text-sm font-medium text-gray-900 dark:text-white"
              >{BITCOIN_SELL_POLICY_LABELS[policy]}</span
            >
            <span class="mt-0.5 block text-xs text-gray-500">
              {#if policy === 'athHarvest'}
                Sells only after retirement, only near a recorded high, and only when liquid reserves
                (HYSA / CDs / bonds) are thin. A long grind below ATH will not trigger a sale — the
                sleeve can sit through a bear until it is needed for spending.
              {:else if policy === 'allocationTrim'}
                Does not wait for a peak. Each year, if Bitcoin/crypto is too large versus the rest of
                the portfolio, or HYSA runway is below the floor, sell a small clip into HYSA. Stops
                the “hold it while it dies” path at the cost of realizing some gains off the top.
              {:else}
                Near-ATH harvest still fires on peaks. Balanced trim also clips along the way when the
                sleeve is overweight or cash is thin, so a grind-down does not wait for a high that
                never returns.
              {/if}
            </span>
          </span>
        </label>
      {/each}
    </fieldset>

    {#if showAth}
      <div class="space-y-3">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Near-ATH harvest</h3>
        <label class="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            class="mt-1 rounded"
            bind:checked={$planStore.taxStrategy.athHarvestEnabled}
          />
          <span>
            <span class="font-medium text-gray-900 dark:text-white">Run near-ATH harvest</span>
            <span class="block text-xs text-gray-500 mt-0.5">
              Off preserves a full HODL until spending needs the sleeve. Saved plans that had harvest
              disabled in Tax Strategy stay off until you check this.
            </span>
          </span>
        </label>
        {#if $planStore.taxStrategy.athHarvestEnabled !== false}
          <p class="text-xs text-gray-500">
            When liquid reserves are below {$planStore.taxStrategy.athHarvestBufferYears ?? 4} years of
            spending and price is at or within
            {(($planStore.taxStrategy.athHarvestNearAthFraction ?? 0.05) * 100).toFixed(1)}% of its
            highest observed price, sell up to
            {(($planStore.taxStrategy.athHarvestMaxSleeveFraction ?? 0.16) * 100).toFixed(0)}% of that
            holding into HYSA after estimated capital-gains tax.
          </p>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block text-sm">
              <span class="text-gray-600 dark:text-gray-400">Max annual sale (% of each holding)</span>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                class={inputClass}
                value={(($planStore.taxStrategy.athHarvestMaxSleeveFraction ?? 0.16) * 100).toFixed(0)}
                on:input={(e) => setAthHarvestPct('athHarvestMaxSleeveFraction', e.currentTarget.value)}
              />
            </label>
            <label class="block text-sm">
              <span class="text-gray-600 dark:text-gray-400">Cash buffer target (years)</span>
              <input
                type="number"
                min="0"
                max="10"
                step="0.5"
                class={inputClass}
                value={$planStore.taxStrategy.athHarvestBufferYears ?? 4}
                on:input={(e) => setAthBufferYears(e.currentTarget.value)}
              />
              <span class="mt-1 block text-xs text-gray-500"
                >Harvest only when HYSA + CDs + bonds are below this many years of spending</span
              >
            </label>
            <label class="block text-sm">
              <span class="text-gray-600 dark:text-gray-400">Near-ATH tolerance (%)</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                class={inputClass}
                value={(($planStore.taxStrategy.athHarvestNearAthFraction ?? 0.05) * 100).toFixed(1)}
                on:input={(e) => setAthHarvestPct('athHarvestNearAthFraction', e.currentTarget.value)}
              />
              <span class="mt-1 block text-xs text-gray-500"
                >0% requires the peak or higher. At 5%, a $100,000 peak qualifies from $95,000.</span
              >
            </label>
            <label class="block text-sm">
              <span class="text-gray-600 dark:text-gray-400">Harvesting window</span>
              <select class={inputClass} bind:value={$planStore.taxStrategy.athHarvestWindow}>
                <option value="ssGap">Retirement until Social Security</option>
                <option value="retirement">Throughout retirement</option>
              </select>
            </label>
          </div>
        {/if}
      </div>
    {/if}

    {#if showTrim}
      <div class="space-y-3">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Balanced trim</h3>
        <p class="text-xs text-gray-500">
          Each qualifying year sells at most
          {((strategy.trimMaxSleeveFraction ?? 0.08) * 100).toFixed(0)}% of the Bitcoin
          {strategy.includeCryptoInTrim !== false ? ' (and crypto)' : ''} sleeve — small clips over
          several years, not a dump at the bottom. HYSA is the destination after estimated sale tax.
        </p>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm">
            <span class="text-gray-600 dark:text-gray-400">Max alt share of non-alt portfolio (%)</span>
            <input
              type="number"
              min="0"
              max="200"
              step="1"
              class={inputClass}
              value={((strategy.maxAltShareOfNonAlt ?? 0.35) * 100).toFixed(0)}
              on:input={(e) => setStrategyPct('maxAltShareOfNonAlt', e.currentTarget.value)}
            />
            <span class="mt-1 block text-xs text-gray-500"
              >35% means BTC{strategy.includeCryptoInTrim !== false ? '+crypto' : ''} may be 35% of
              everything that is not those alts. Above that, trim toward the cap.</span
            >
          </label>
          <label class="block text-sm">
            <span class="text-gray-600 dark:text-gray-400">Max clip per year (% of sleeve)</span>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              class={inputClass}
              value={((strategy.trimMaxSleeveFraction ?? 0.08) * 100).toFixed(0)}
              on:input={(e) => setStrategyPct('trimMaxSleeveFraction', e.currentTarget.value)}
            />
          </label>
          <label class="block text-sm">
            <span class="text-gray-600 dark:text-gray-400">Trim when HYSA below (years)</span>
            <input
              type="number"
              min="0"
              max="10"
              step="0.5"
              class={inputClass}
              value={strategy.trimWhenCashBelowYears ?? 2}
              on:input={(e) => setTrimCashYears(e.currentTarget.value)}
            />
            <span class="mt-1 block text-xs text-gray-500"
              >Uses HYSA only (not CDs or bonds). Set 0 to ignore cash and trim only for allocation.</span
            >
          </label>
          <label class="block text-sm">
            <span class="text-gray-600 dark:text-gray-400">When trim may run</span>
            <select class={inputClass} bind:value={$planStore.bitcoinStrategy.trimWindow}>
              {#each trimWindows as window}
                <option value={window}>{BITCOIN_TRIM_WINDOW_LABELS[window]}</option>
              {/each}
            </select>
          </label>
        </div>
        <label class="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            class="mt-1 rounded"
            bind:checked={$planStore.bitcoinStrategy.includeCryptoInTrim}
          />
          <span>
            <span class="font-medium text-gray-900 dark:text-white">Include other crypto in the sleeve</span>
            <span class="block text-xs text-gray-500 mt-0.5">
              When on, non-BTC crypto counts toward the overweight test and can be sold after Bitcoin.
              Gold and silver are never trimmed by this rule.
            </span>
          </span>
        </label>
      </div>
    {/if}
  </PlannerPanel>
</div>
