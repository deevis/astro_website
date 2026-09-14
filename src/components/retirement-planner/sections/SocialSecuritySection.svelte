<script lang="ts">
  import { planStore } from '../lib/planStore';
  import {
    calculateBreakEvenData,
    computePersonBenefits,
    findBreakEvenCrossovers,
    money,
    parseEarningsText,
    type BenefitScenario,
    type BreakEvenCrossover,
    type BreakEvenYearPoint,
    type PersonBenefitResult,
  } from '../lib/socialSecurity';
  import { computeFutureWorkYears } from '../lib/types';

  type PersonKey = 'primary' | 'spouse';

  let activePerson: PersonKey = 'primary';
  let view: 'input' | 'results' | 'breakeven' = 'input';
  let error = '';
  let resultsByOwner: Partial<Record<PersonKey, PersonBenefitResult>> = {};

  let compareAges = [62, 67, 70];
  let colaPercent = 2.5;
  let enableInvestment = false;
  let investmentPercent = 0;
  let expectedYieldPercent = 7;
  let breakEvenData: Record<number, BreakEvenYearPoint[]> = {};
  let crossovers: BreakEvenCrossover[] = [];

  $: persons = $planStore.socialSecurity;
  $: lifeExpectancy =
    activePerson === 'spouse' && $planStore.spouse
      ? $planStore.spouse.lifeExpectancy
      : $planStore.primary.lifeExpectancy;

  function personAge(owner: PersonKey): number {
    if (owner === 'spouse' && $planStore.spouse) return $planStore.spouse.currentAge;
    return $planStore.primary.currentAge;
  }

  function personRetirementAge(owner: PersonKey): number {
    if (owner === 'spouse' && $planStore.spouse) return $planStore.spouse.retirementAge;
    return $planStore.primary.retirementAge;
  }

  function futureWorkYearsFor(owner: PersonKey): number {
    return computeFutureWorkYears(personAge(owner), personRetirementAge(owner));
  }

  function personName(owner: PersonKey): string {
    if (owner === 'spouse') return $planStore.spouse?.name ?? 'Spouse';
    return $planStore.primary.name;
  }

  function indexFor(owner: PersonKey): number {
    return $planStore.socialSecurity.findIndex((s) => s.owner === owner);
  }

  function setEarningsText(owner: PersonKey, text: string) {
    const i = indexFor(owner);
    if (i < 0) return;
    $planStore.socialSecurity[i].earningsHistory = parseEarningsText(text);
  }

  function earningsText(owner: PersonKey): string {
    const person = $planStore.socialSecurity.find((s) => s.owner === owner);
    return (person?.earningsHistory ?? []).map((e) => `${e.year}\t${e.amount}`).join('\n');
  }

  function calculateAll() {
    error = '';
    const next: Partial<Record<PersonKey, PersonBenefitResult>> = {};

    for (const person of $planStore.socialSecurity) {
      const age = personAge(person.owner);
      if (!age) {
        error = `Enter current age for ${personName(person.owner)} in Household.`;
        return;
      }
      if (person.earningsHistory.length === 0) {
        error = `Paste earnings history for ${personName(person.owner)}.`;
        return;
      }

      const result = computePersonBenefits({
        currentAge: age,
        earningsHistory: person.earningsHistory,
        claimAge: person.claimAge,
        futureWorkYears: futureWorkYearsFor(person.owner),
        futureAnnualEarnings: person.futureAnnualEarnings,
      });

      if (!result) {
        error = `Could not calculate benefits for ${personName(person.owner)}.`;
        return;
      }

      next[person.owner] = result;
      const i = indexFor(person.owner);
      if (i >= 0) {
        $planStore.socialSecurity[i].estimatedMonthlyBenefit = result.claimAgeMonthly;
      }
    }

    resultsByOwner = next;
    activePerson = 'primary';
    view = 'results';
    runBreakEven();
  }

  function activeResult(): PersonBenefitResult | null {
    return resultsByOwner[activePerson] ?? null;
  }

  function activeScenario(): BenefitScenario | null {
    const r = activeResult();
    if (!r) return null;
    return r.withFuture ?? r.base;
  }

  function runBreakEven() {
    const scenario = activeScenario();
    if (!scenario) return;

    const ages = [...new Set(compareAges.filter((a) => a >= 62 && a <= 70))].sort(
      (a, b) => a - b
    );
    if (ages.length === 0) return;

    breakEvenData = calculateBreakEvenData(
      scenario.benefitsByAge,
      ages,
      lifeExpectancy,
      colaPercent / 100,
      enableInvestment ? investmentPercent / 100 : 0,
      enableInvestment ? expectedYieldPercent / 100 : 0
    );
    crossovers = findBreakEvenCrossovers(breakEvenData, ages, enableInvestment);
  }

  const personKeys: PersonKey[] = ['primary', 'spouse'];

  function adjustmentLabel(age: number): string {
    if (age < 67) return 'Reduction';
    if (age > 67) return 'Increase';
    return 'Full retirement age';
  }

  function endCumulative(age: number): number {
    const series = breakEvenData[age];
    if (!series?.length) return 0;
    const last = series[series.length - 1];
    return enableInvestment ? last.totalWithInvestments : last.cumulativeTotal;
  }
</script>

<section
  class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 shadow-sm px-5 py-5 sm:px-6 space-y-6"
>
  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Social Security</h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
        Paste SSA earnings, estimate monthly benefits by claim age, and compare break-even points.
        Uses 2026 bend points and full retirement age 67, with 2.5% assumed growth for unpublished wage data. Work-credit eligibility and spousal/survivor benefits are not modeled.
      </p>
    </div>
    <button
      type="button"
      class="shrink-0 px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
      on:click={calculateAll}
    >
      Calculate benefits
    </button>
  </div>

  {#if error}
    <p class="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
  {/if}

  <div class="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
    <button
      type="button"
      class="px-3 py-1.5 rounded-lg text-sm {view === 'input'
        ? 'bg-primary-600 text-white'
        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}"
      on:click={() => (view = 'input')}
    >
      Input
    </button>
    <button
      type="button"
      class="px-3 py-1.5 rounded-lg text-sm {view === 'results'
        ? 'bg-primary-600 text-white'
        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'} {!Object.keys(resultsByOwner).length
        ? 'opacity-40 cursor-not-allowed'
        : ''}"
      disabled={!Object.keys(resultsByOwner).length}
      on:click={() => (view = 'results')}
    >
      Results
    </button>
    <button
      type="button"
      class="px-3 py-1.5 rounded-lg text-sm {view === 'breakeven'
        ? 'bg-primary-600 text-white'
        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'} {!Object.keys(resultsByOwner).length
        ? 'opacity-40 cursor-not-allowed'
        : ''}"
      disabled={!Object.keys(resultsByOwner).length}
      on:click={() => {
        view = 'breakeven';
        runBreakEven();
      }}
    >
      Break-even
    </button>
  </div>

  {#if view === 'input'}
    {#each persons as person, i (person.owner)}
      <fieldset class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
        <legend class="px-1 text-sm font-semibold text-gray-900 dark:text-white">
          {personName(person.owner)}
          <span class="font-normal text-gray-500">· age {personAge(person.owner)}</span>
        </legend>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label class="block text-sm">
            <span class="text-gray-600 dark:text-gray-400">Claim age</span>
            <input
              type="number"
              min="62"
              max="70"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
              bind:value={$planStore.socialSecurity[i].claimAge}
            />
          </label>
          <label class="block text-sm">
            <span class="text-gray-600 dark:text-gray-400">Future work years</span>
            <input
              type="number"
              min="0"
              max="40"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-gray-700 dark:text-gray-300"
              value={futureWorkYearsFor(person.owner)}
              readonly
              title="Computed from Household: retirement age − current age"
            />
            <span class="mt-0.5 block text-[11px] text-gray-500">
              Computed: retirement {personRetirementAge(person.owner)} − age {personAge(person.owner)}
            </span>
          </label>
          <label class="block text-sm md:col-span-2">
            <span class="text-gray-600 dark:text-gray-400">Expected annual earnings</span>
            <input
              type="number"
              min="0"
              class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
              bind:value={$planStore.socialSecurity[i].futureAnnualEarnings}
            />
          </label>
        </div>
        <label class="block text-sm">
          <span class="text-gray-600 dark:text-gray-400">Earnings history (paste from SSA statement)</span>
          <textarea
            rows="6"
            class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 font-mono text-xs"
            placeholder={"Year\tEarnings\n2010\t45000\n2011\t47000"}
            value={earningsText(person.owner)}
            on:input={(e) => setEarningsText(person.owner, e.currentTarget.value)}
          ></textarea>
          <span class="mt-1 block text-xs text-gray-500">
            {person.earningsHistory.length} year(s) parsed
            {#if person.estimatedMonthlyBenefit}
              · estimated claim benefit {money(person.estimatedMonthlyBenefit, 2)}/mo
            {/if}
          </span>
        </label>
      </fieldset>
    {/each}
  {:else if view === 'results'}
    {#if $planStore.filingStatus === 'married' && resultsByOwner.spouse}
      <div class="flex flex-wrap gap-2">
        {#each personKeys as key}
          {#if resultsByOwner[key]}
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg text-sm {activePerson === key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800'}"
              on:click={() => {
                activePerson = key;
                runBreakEven();
              }}
            >
              {personName(key)}
            </button>
          {/if}
        {/each}
      </div>
    {/if}

    {#if activeResult()}
      {@const result = activeResult()}
      {@const scenario = activeScenario()}
      {#if result && scenario}
        <div class="grid gap-4 md:grid-cols-3">
          <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p class="text-xs uppercase tracking-wide text-gray-500">AIME</p>
            <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
              {money(scenario.aime, 2)}
            </p>
            <p class="mt-1 text-xs text-gray-500">Avg indexed monthly earnings (top 35 years)</p>
          </div>
          <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <p class="text-xs uppercase tracking-wide text-gray-500">PIA (at FRA 67)</p>
            <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
              {money(scenario.pia, 2)}
            </p>
            <p class="mt-1 text-xs text-gray-500">Primary insurance amount / month</p>
          </div>
          <div class="rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-950/30 p-4">
            <p class="text-xs uppercase tracking-wide text-primary-700 dark:text-primary-300">
              At claim age {$planStore.socialSecurity.find((s) => s.owner === activePerson)?.claimAge}
            </p>
            <p class="mt-1 text-2xl font-semibold text-primary-700 dark:text-primary-300">
              {money(result.claimAgeMonthly, 2)}
            </p>
            <p class="mt-1 text-xs text-primary-700/80 dark:text-primary-300/80">Estimated monthly benefit</p>
          </div>
        </div>

        {#if result.withFuture}
          <div class="text-sm text-gray-600 dark:text-gray-400 rounded-lg bg-gray-50 dark:bg-gray-900/50 px-3 py-2">
            Without future work: PIA {money(result.base.pia, 2)} · With future work: PIA
            {money(result.withFuture.pia, 2)}
            ({result.withFuture.pia >= result.base.pia ? '+' : ''}{money(
              result.withFuture.pia - result.base.pia,
              2
            )})
          </div>
        {/if}

        <div>
          <h3 class="font-medium text-gray-900 dark:text-white mb-2">PIA bend-point breakdown</h3>
          <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="min-w-full text-sm">
              <thead class="bg-gray-50 dark:bg-gray-800/80 text-left text-gray-600 dark:text-gray-400">
                <tr>
                  <th class="px-3 py-2 font-medium">Earnings range</th>
                  <th class="px-3 py-2 font-medium">Rate</th>
                  <th class="px-3 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {#each scenario.breakdown as tier}
                  <tr class="border-t border-gray-200 dark:border-gray-700">
                    <td class="px-3 py-2">{tier.range}</td>
                    <td class="px-3 py-2">{tier.percentage}</td>
                    <td class="px-3 py-2">{money(tier.amount, 2)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 class="font-medium text-gray-900 dark:text-white mb-2">Monthly benefit by claim age</h3>
          <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="min-w-full text-sm">
              <thead class="bg-gray-50 dark:bg-gray-800/80 text-left text-gray-600 dark:text-gray-400">
                <tr>
                  <th class="px-3 py-2 font-medium">Age</th>
                  <th class="px-3 py-2 font-medium">Monthly</th>
                  <th class="px-3 py-2 font-medium">Adjustment</th>
                </tr>
              </thead>
              <tbody>
                {#each Object.entries(scenario.benefitsByAge) as [age, benefit]}
                  <tr
                    class="border-t border-gray-200 dark:border-gray-700 {Number(age) ===
                    ($planStore.socialSecurity.find((s) => s.owner === activePerson)?.claimAge ?? 0)
                      ? 'bg-primary-50/60 dark:bg-primary-950/20'
                      : ''}"
                  >
                    <td class="px-3 py-2">{age}</td>
                    <td class="px-3 py-2 font-medium">{money(benefit, 2)}</td>
                    <td class="px-3 py-2 text-gray-500">{adjustmentLabel(Number(age))}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 class="font-medium text-gray-900 dark:text-white mb-2">Top indexed earning years</h3>
          <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 max-h-64 overflow-y-auto">
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 bg-gray-50 dark:bg-gray-800 text-left text-gray-600 dark:text-gray-400">
                <tr>
                  <th class="px-3 py-2 font-medium">Year</th>
                  <th class="px-3 py-2 font-medium">Total</th>
                  <th class="px-3 py-2 font-medium">SS-eligible</th>
                  <th class="px-3 py-2 font-medium">Indexed</th>
                </tr>
              </thead>
              <tbody>
                {#each scenario.earningsData.slice(0, 35) as row}
                  <tr
                    class="border-t border-gray-200 dark:border-gray-700 {row.totalEarnings === 0
                      ? 'opacity-50'
                      : ''}"
                  >
                    <td class="px-3 py-1.5">{row.year}</td>
                    <td class="px-3 py-1.5">{money(row.totalEarnings)}</td>
                    <td class="px-3 py-1.5">{money(row.earnings)}</td>
                    <td class="px-3 py-1.5">{money(row.indexedEarnings ?? 0)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    {/if}
  {:else if view === 'breakeven'}
    {#if $planStore.filingStatus === 'married' && resultsByOwner.spouse}
      <div class="flex flex-wrap gap-2">
        {#each personKeys as key}
          {#if resultsByOwner[key]}
            <button
              type="button"
              class="px-3 py-1.5 rounded-lg text-sm {activePerson === key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800'}"
              on:click={() => {
                activePerson = key;
                runBreakEven();
              }}
            >
              {personName(key)}
            </button>
          {/if}
        {/each}
      </div>
    {/if}

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Compare age 1</span>
        <input
          type="number"
          min="62"
          max="70"
          class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
          bind:value={compareAges[0]}
          on:change={runBreakEven}
        />
      </label>
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Compare age 2</span>
        <input
          type="number"
          min="62"
          max="70"
          class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
          bind:value={compareAges[1]}
          on:change={runBreakEven}
        />
      </label>
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">Compare age 3</span>
        <input
          type="number"
          min="62"
          max="70"
          class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
          bind:value={compareAges[2]}
          on:change={runBreakEven}
        />
      </label>
      <label class="block text-sm">
        <span class="text-gray-600 dark:text-gray-400">COLA (%)</span>
        <input
          type="number"
          step="0.1"
          class="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
          bind:value={colaPercent}
          on:change={runBreakEven}
        />
      </label>
    </div>

    <div class="flex flex-wrap items-end gap-4">
      <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          class="rounded"
          bind:checked={enableInvestment}
          on:change={runBreakEven}
        />
        Model investing a portion of benefits
      </label>
      {#if enableInvestment}
        <label class="block text-sm">
          <span class="text-gray-600 dark:text-gray-400">Invest %</span>
          <input
            type="number"
            min="0"
            max="100"
            class="mt-1 w-28 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
            bind:value={investmentPercent}
            on:change={runBreakEven}
          />
        </label>
        <label class="block text-sm">
          <span class="text-gray-600 dark:text-gray-400">Expected yield (%)</span>
          <input
            type="number"
            step="0.1"
            class="mt-1 w-28 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2"
            bind:value={expectedYieldPercent}
            on:change={runBreakEven}
          />
        </label>
      {/if}
      <p class="text-xs text-gray-500">Life expectancy {lifeExpectancy} (from Household)</p>
    </div>

    {#if crossovers.length}
      <ul class="space-y-2">
        {#each crossovers as c}
          <li
            class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2 text-sm"
          >
            Claiming at <strong>{c.laterAge}</strong> overtakes claiming at
            <strong>{c.earlierAge}</strong> around age <strong>{c.crossoverAge}</strong>
            {#if enableInvestment}
              <span class="text-gray-500"> (including investments)</span>
            {/if}.
          </li>
        {/each}
      </ul>
    {:else}
      <p class="text-sm text-gray-500 dark:text-gray-400">
        No crossover before life expectancy {lifeExpectancy} for the selected ages — the earlier claim stays ahead
        on cumulative totals in this window.
      </p>
    {/if}

    <div>
      <h3 class="font-medium text-gray-900 dark:text-white mb-2">
        Cumulative totals at age {lifeExpectancy}
      </h3>
      <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table class="min-w-full text-sm">
          <thead class="bg-gray-50 dark:bg-gray-800/80 text-left text-gray-600 dark:text-gray-400">
            <tr>
              <th class="px-3 py-2 font-medium">Claim age</th>
              <th class="px-3 py-2 font-medium">Starting monthly</th>
              <th class="px-3 py-2 font-medium">Lifetime cumulative</th>
            </tr>
          </thead>
          <tbody>
            {#each Object.keys(breakEvenData)
              .map(Number)
              .sort((a, b) => a - b) as age}
              {@const series = breakEvenData[age]}
              <tr class="border-t border-gray-200 dark:border-gray-700">
                <td class="px-3 py-2">{age}</td>
                <td class="px-3 py-2">{money(series[0]?.monthlyAmount ?? 0, 2)}</td>
                <td class="px-3 py-2 font-medium">{money(endCumulative(age))}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</section>
