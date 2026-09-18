<script lang="ts">
  import type { Action } from 'svelte/action';
  import { planStore, saveStatus } from './lib/planStore';
  import {
    PLANNER_SECTIONS,
    otherAssetsTotalValue,
    realEstateNetEquity,
    type PlannerSectionId,
  } from './lib/types';
  import { getSectionStatuses, readyForProjection } from './lib/planHealth';
  import { money } from './lib/cashflow';
  import HouseholdSection from './sections/HouseholdSection.svelte';
  import AssetsSection from './sections/AssetsSection.svelte';
  import RealEstateSection from './sections/RealEstateSection.svelte';
  import OtherAssetsSection from './sections/OtherAssetsSection.svelte';
  import IncomeExpensesSection from './sections/IncomeExpensesSection.svelte';
  import SocialSecuritySection from './sections/SocialSecuritySection.svelte';
  import AssumptionsSection from './sections/AssumptionsSection.svelte';
  import BitcoinStrategySection from './sections/BitcoinStrategySection.svelte';
  import DateOptimizerSection from './sections/DateOptimizerSection.svelte';
  import RampSection from './sections/RampSection.svelte';
  import ProjectionSection from './sections/ProjectionSection.svelte';
  import MonteCarloSection from './sections/MonteCarloSection.svelte';
  import TaxStrategySection from './sections/TaxStrategySection.svelte';

  let activeSection: PlannerSectionId = 'household';
  let statusMessage = '';
  let fileInput: HTMLInputElement;
  let autosaveTimer: ReturnType<typeof setInterval> | undefined;

  $: sectionStatuses = getSectionStatuses($planStore);
  $: statusById = Object.fromEntries(sectionStatuses.map((s) => [s.id, s]));
  $: totalBalance = $planStore.accounts.reduce((s, a) => s + a.balance, 0);
  $: realEstateEquity = ($planStore.realEstate ?? []).reduce(
    (s, p) => s + realEstateNetEquity(p),
    0
  );
  $: otherAssetsValue = otherAssetsTotalValue($planStore.otherAssets ?? []);
  $: netWorth = totalBalance + realEstateEquity + otherAssetsValue;
  $: completedCount = sectionStatuses.filter(
    (s) => s.complete && s.id !== 'taxStrategy' && s.id !== 'dateOptimizer' && s.id !== 'ramp'
  ).length;
  $: setupTotal = sectionStatuses.filter(
    (s) => s.id !== 'taxStrategy' && s.id !== 'dateOptimizer' && s.id !== 'ramp'
  ).length;
  $: canProject = readyForProjection($planStore);

  const suggestedFlow: { id: PlannerSectionId; label: string }[] = [
    { id: 'household', label: 'Household' },
    { id: 'assets', label: 'Assets' },
    { id: 'bitcoin', label: 'Bitcoin' },
    { id: 'realEstate', label: 'Real estate' },
    { id: 'otherAssets', label: 'Other assets' },
    { id: 'socialSecurity', label: 'Social Security' },
    { id: 'dateOptimizer', label: 'Date optimizer' },
    { id: 'ramp', label: 'RAMP' },
    { id: 'projection', label: 'Projection' },
  ];

  const initPlanner: Action<HTMLElement> = () => {
    planStore.hydrate();
    autosaveTimer = setInterval(() => planStore.persist(), 2000);
    const flush = () => {
      planStore.persist();
    };
    window.addEventListener('pagehide', flush);
    return () => {
      clearInterval(autosaveTimer);
      window.removeEventListener('pagehide', flush);
      planStore.persist();
    };
  };

  function formatSavedAt(iso: string): string {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  function handleExport() {
    planStore.persistAndTouch();
    planStore.exportJson();
    flash('Plan downloaded as JSON.');
  }

  function handleImportClick() {
    fileInput?.click();
  }

  async function handleFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      planStore.importJson(text);
      flash('Plan imported and saved locally.');
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Import failed.');
    }
    input.value = '';
  }

  function handleReset() {
    if (!confirm('Clear this plan and delete local saved data? This cannot be undone.')) return;
    if (planStore.reset()) { activeSection = 'household'; flash('Plan reset.'); }
  }

  function flash(message: string) {
    statusMessage = message;
    setTimeout(() => {
      if (statusMessage === message) statusMessage = '';
    }, 3500);
  }

  function goToSection(id: PlannerSectionId) {
    activeSection = id;
    requestAnimationFrame(() => document.getElementById('planner-section-content')?.scrollIntoView({ block: 'start' }));
  }
</script>

<div class="retirement-planner space-y-6" use:initPlanner>
  <header class="border-b border-gray-200 dark:border-gray-800 pb-6">
    <p class="text-sm font-medium text-primary-600 dark:text-primary-400 mb-2">Apps · Privacy-first</p>
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
      <div class="min-w-0 flex-1">
        <h1 class="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
          Retirement Planner
        </h1>
        <p class="mt-2 max-w-2xl text-gray-600 dark:text-gray-400 leading-relaxed">
          Model household assets, Social Security, and spending — then stress-test your plan with
          deterministic projections and Monte Carlo simulation.
        </p>
        <nav class="mt-4" aria-label="Suggested flow">
          <p class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Suggested flow
          </p>
          <ol class="flex flex-wrap items-center gap-x-1 gap-y-2">
            {#each suggestedFlow as step, i}
              {@const status = statusById[step.id]}
              {@const isActive = activeSection === step.id}
              <li class="flex items-center gap-1">
                <button
                  type="button"
                  class="flow-step {isActive ? 'flow-step-active' : status?.complete ? 'flow-step-done' : ''}"
                  title={status?.hint ?? step.label}
                  aria-current={isActive ? 'step' : undefined}
                  on:click={() => goToSection(step.id)}
                >
                  <span class="flow-step-num" aria-hidden="true">{i + 1}</span>
                  {step.label}
                </button>
                {#if i < suggestedFlow.length - 1}
                  <span class="hidden text-gray-300 dark:text-gray-600 sm:inline" aria-hidden="true">→</span>
                {/if}
              </li>
            {/each}
          </ol>
        </nav>
      </div>
      <aside
        class="shrink-0 rounded-xl border border-emerald-200/80 dark:border-emerald-800/50 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/40 dark:to-gray-900/40 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100 lg:max-w-[16.5rem]"
      >
        <p class="font-semibold text-emerald-800 dark:text-emerald-200">
          Your data never leaves this device
        </p>
        <p class="mt-1 text-xs leading-relaxed text-emerald-800/80 dark:text-emerald-200/80">
          Plans autosave in this browser. Export JSON for backup — no accounts or servers required.
        </p>
      </aside>
    </div>
  </header>

  <div
    class="md:sticky top-28 z-20 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-sm"
  >
    <div class="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div class="min-w-0 flex-1">
        <p class="truncate text-base font-semibold text-gray-900 dark:text-white">{$planStore.name}</p>
        <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          <span aria-live="polite">{$saveStatus.savedAt ? 'Saved locally ' + formatSavedAt($saveStatus.savedAt) : 'Not saved yet'}</span>
          {#if totalBalance > 0}
            <span class="text-gray-400">·</span>
            <span>Portfolio {money(totalBalance)}</span>
          {/if}
          {#if realEstateEquity > 0 || otherAssetsValue > 0}
            <span class="text-gray-400">·</span>
            <span
              title="Portfolio {money(totalBalance)} + RE equity {money(realEstateEquity)} + other {money(otherAssetsValue)}"
              >Net Worth {money(netWorth)}</span
            >
          {:else if totalBalance <= 0 && netWorth > 0}
            <span class="text-gray-400">·</span>
            <span>Net Worth {money(netWorth)}</span>
          {/if}
          {#if statusMessage}
            <span role="status" class="text-primary-600 dark:text-primary-400 font-medium">{statusMessage}</span>
          {/if}
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="btn-primary"
          on:click={() => {
            if (planStore.persistAndTouch()) flash('Saved locally.');
          }}
        >
          Save
        </button>
        <button type="button" class="btn-secondary" on:click={handleExport}>Export</button>
        <button type="button" class="btn-secondary" on:click={handleImportClick}>Import</button>
        <button type="button" class="btn-danger" on:click={handleReset}>Reset</button>
        <input
          bind:this={fileInput}
          type="file"
          accept="application/json,.json"
          class="hidden"
          on:change={handleFileChange}
        />
      </div>
    </div>

    {#if !canProject}
      <div
        class="border-t border-amber-200/60 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-100 sm:px-5"
      >
        Add accounts with balances and spending inputs before projections and Monte Carlo will be meaningful.
      </div>
    {/if}
  </div>

  {#if $saveStatus.error}
    <p role="alert" class="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{$saveStatus.error}</p>
  {/if}

  <div class="flex flex-col gap-6 xl:flex-row xl:items-start">
    <aside class="xl:w-60 2xl:w-64 shrink-0 space-y-4">
      <label class="block xl:hidden text-sm font-medium">
        <span class="mb-1 flex items-baseline justify-between gap-2">
          <span>Plan section</span>
          <span class="text-[10px] font-normal text-gray-500 dark:text-gray-400">
            Setup {completedCount}/{setupTotal} complete
          </span>
        </span>
        <select class="field-input" value={activeSection} on:change={(e) => goToSection(e.currentTarget.value as PlannerSectionId)}>
          {#each PLANNER_SECTIONS as section}<option value={section.id}>{section.label}</option>{/each}
        </select>
      </label>
      <nav class="hidden xl:block" aria-label="Planner sections">
        <div class="mb-2 flex items-baseline justify-between gap-2 px-1">
          <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Plan sections
          </p>
          <span class="shrink-0 text-[10px] text-gray-500 dark:text-gray-400">
            Setup {completedCount}/{setupTotal} complete
          </span>
        </div>
        <ul class="flex gap-1 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible xl:pb-0">
          {#each PLANNER_SECTIONS as section}
            {@const status = statusById[section.id]}
            <li>
              <button
                type="button"
                class="nav-item w-full {activeSection === section.id ? 'nav-item-active' : ''}"
                aria-current={activeSection === section.id ? 'step' : undefined}
                title={status?.hint}
                on:click={() => goToSection(section.id)}
              >
                <span class="flex items-center gap-2 min-w-0">
                  <span
                    class="status-dot {status?.complete
                      ? 'bg-emerald-500'
                      : section.comingSoon
                        ? 'bg-gray-300 dark:bg-gray-600'
                        : 'bg-amber-400'}"
                    aria-hidden="true"
                  ></span>
                  <span class="truncate">{section.label}</span>
                </span>
                {#if section.comingSoon}
                  <span class="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400"
                    >Soon</span
                  >
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      </nav>
    </aside>

    <section id="planner-section-content" class="min-w-0 flex-1 w-full scroll-mt-56" aria-label="Current planner section">
      {#if activeSection === 'household'}
        <HouseholdSection />
      {:else if activeSection === 'assets'}
        <AssetsSection />
      {:else if activeSection === 'bitcoin'}
        <BitcoinStrategySection />
      {:else if activeSection === 'realEstate'}
        <RealEstateSection />
      {:else if activeSection === 'otherAssets'}
        <OtherAssetsSection />
      {:else if activeSection === 'incomeExpenses'}
        <IncomeExpensesSection />
      {:else if activeSection === 'socialSecurity'}
        <SocialSecuritySection />
      {:else if activeSection === 'assumptions'}
        <AssumptionsSection />
      {:else if activeSection === 'dateOptimizer'}
        <DateOptimizerSection />
      {:else if activeSection === 'ramp'}
        <RampSection on:navigate={(e) => goToSection(e.detail)} />
      {:else if activeSection === 'projection'}
        <ProjectionSection />
      {:else if activeSection === 'monteCarlo'}
        <MonteCarloSection />
      {:else if activeSection === 'taxStrategy'}
        <TaxStrategySection />
      {/if}
    </section>
  </div>
</div>

<style>
  :global(.retirement-planner button:focus-visible), :global(.retirement-planner select:focus-visible) { outline: 2px solid #2563eb; outline-offset: 3px; }
  :global(.retirement-planner button:disabled) { opacity: 0.5; cursor: not-allowed; }
  :global(.retirement-planner button:not(.flow-step):not(.btn-compact)) { min-height: 40px; }

  :global(.retirement-planner .btn-primary) {
    @apply px-3 py-1.5 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors;
  }
  :global(.retirement-planner .btn-secondary) {
    @apply px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors;
  }
  :global(.retirement-planner .btn-compact) {
    min-height: 0;
    @apply px-2 py-0.5 rounded-md text-[11px] font-medium leading-tight;
  }
  :global(.retirement-planner .btn-danger) {
    @apply px-3 py-1.5 rounded-lg text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors;
  }
  :global(.retirement-planner .field-input) {
    @apply mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors;
  }
  :global(.retirement-planner .field-label) {
    @apply block text-sm text-gray-600 dark:text-gray-400;
  }
  .nav-item {
    @apply flex items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors;
  }
  .nav-item-active {
    @apply bg-primary-600 text-white hover:bg-primary-600;
  }
  .nav-item-active .status-dot {
    @apply ring-2 ring-white/40;
  }
  .status-dot {
    @apply h-2 w-2 shrink-0 rounded-full;
  }
  .flow-step {
    @apply inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1 text-xs text-gray-600 dark:text-gray-300 hover:border-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors;
  }
  .flow-step-num {
    @apply flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-[10px] font-semibold text-gray-700 dark:text-gray-200;
  }
  .flow-step-active {
    @apply border-primary-500 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-950/50 dark:text-primary-100;
  }
  .flow-step-active .flow-step-num {
    @apply bg-primary-600 text-white dark:bg-primary-500;
  }
  .flow-step-done .flow-step-num {
    @apply bg-emerald-500 text-white;
  }
</style>
