<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { get } from 'svelte/store';
  import { planStore } from '../lib/planStore';
  import { readyForProjection } from '../lib/planHealth';
  import { money, projectCashflow, type ProjectionResult } from '../lib/cashflow';
  import { formatEventSummary } from '../lib/events';
  import { loadChartJs, type ChartInstance } from '../lib/loadChart';
  import PlannerPanel from '../PlannerPanel.svelte';
  import EmptyState from '../EmptyState.svelte';

  let canvasEl: HTMLCanvasElement;
  let chart: ChartInstance | null = null;
  let result: ProjectionResult | null = null;
  let chartError = '';
  let projectionError = '';
  let showTable = false;
  let expandedAge: number | null = null;
  let mounted = false;
  let renderId = 0;

  $: planReady = readyForProjection($planStore);
  $: if (mounted && $planStore) refresh();

  function refresh() {
    if (!readyForProjection(get(planStore))) { result = null; return; }
    try {
      result = projectCashflow(get(planStore));
      projectionError = '';
      void renderChart(result);
    } catch (e) {
      projectionError = e instanceof Error ? e.message : 'Check your plan inputs.';
      result = null;
      renderId++;
      chart?.destroy(); chart = null;
    }
  }

  onMount(() => {
    mounted = true;
    return () => { mounted = false; renderId++; };
  });

  async function renderChart(projection: ProjectionResult | null) {
    const currentRender = ++renderId;
    await tick();
    if (!mounted || !projection || !canvasEl) return;

    try {
      const Chart = await loadChartJs();
      if (!mounted || currentRender !== renderId) return;
      chartError = '';

      const labels = projection.years.map((y) => String(y.age));
      const isDark = document.documentElement.classList.contains('dark');
      const grid = isDark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.15)';
      const tickColor = isDark ? '#94a3b8' : '#64748b';

      if (chart) {
        chart.data.labels = labels;
        chart.data.datasets[0].data = projection.years.map((y) => y.portfolioTotal);
        chart.data.datasets[1].data = projection.years.map((y) => y.traditional);
        chart.data.datasets[2].data = projection.years.map((y) => y.roth);
        chart.data.datasets[3].data = projection.years.map((y) => y.brokerage);
        chart.data.datasets[4].data = projection.years.map((y) => y.cash);
        chart.data.datasets[5].data = projection.years.map((y) => y.bonds);
        chart.data.datasets[6].data = projection.years.map((y) => y.crypto);
        chart.data.datasets[7].data = projection.years.map((y) => y.bitcoin);
        chart.data.datasets[8].data = projection.years.map((y) => y.gold ?? 0);
        chart.data.datasets[9].data = projection.years.map((y) => y.silver ?? 0);
        chart.data.datasets[10].data = projection.years.map((y) => y.expenses);
        chart.data.datasets[11].data = projection.years.map(
          (y) => y.income + y.socialSecurity
        );
        // Keep latest projection on plugin via chart config
        chart.$projection = projection;
        chart.update('none');
        return;
      }

      const annotationPlugin = {
        id: 'rmdMarkers',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        afterDraw(c: any) {
          const proj: ProjectionResult = c.$projection ?? projection;
          const meta = c.scales.x;
          const yAxis = c.scales.y;
          if (!meta || !yAxis || !proj?.years?.length) return;
          const ctx = c.ctx;
          const markers: { age: number; label: string; color: string }[] = [];
          if (proj.primaryRmdAge >= proj.years[0].age) {
            markers.push({
              age: proj.primaryRmdAge,
              label: 'RMD',
              color: isDark ? '#fbbf24' : '#d97706',
            });
          }
          if (proj.spouseRmdAge != null && proj.spouseRmdAge !== proj.primaryRmdAge) {
            markers.push({
              age: proj.spouseRmdAge,
              label: 'Spouse RMD',
              color: isDark ? '#f472b6' : '#db2777',
            });
          }
          markers.push({
            age: get(planStore).primary.retirementAge,
            label: 'Retire',
            color: isDark ? '#34d399' : '#059669',
          });

          for (const m of markers) {
            const idx = proj.years.findIndex((y) => y.age === m.age);
            if (idx < 0) continue;
            const x = meta.getPixelForValue(idx);
            ctx.save();
            ctx.strokeStyle = m.color;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(x, yAxis.top);
            ctx.lineTo(x, yAxis.bottom);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = m.color;
            ctx.font = '11px sans-serif';
            ctx.fillText(m.label, x + 4, yAxis.top + 12);
            ctx.restore();
          }
        },
      };

      const config = {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Portfolio',
              data: projection.years.map((y) => y.portfolioTotal),
              borderColor: '#2563eb',
              backgroundColor: 'rgba(37,99,235,0.12)',
              fill: true,
              tension: 0.2,
              pointRadius: 0,
              borderWidth: 2,
              yAxisID: 'y',
            },
            {
              label: 'Traditional IRA',
              data: projection.years.map((y) => y.traditional),
              borderColor: '#7c3aed',
              tension: 0.2,
              pointRadius: 0,
              borderWidth: 1.5,
              yAxisID: 'y',
            },
            {
              label: 'Roth IRA',
              data: projection.years.map((y) => y.roth),
              borderColor: '#0891b2',
              tension: 0.2,
              pointRadius: 0,
              borderWidth: 1.5,
              yAxisID: 'y',
            },
            {
              label: 'Brokerage',
              data: projection.years.map((y) => y.brokerage),
              borderColor: '#ea580c',
              tension: 0.2,
              pointRadius: 0,
              borderWidth: 1.5,
              yAxisID: 'y',
            },
            {
              label: 'Cash & CDs',
              data: projection.years.map((y) => y.cash),
              borderColor: '#0d9488',
              tension: 0.2,
              pointRadius: 0,
              borderWidth: 1.5,
              yAxisID: 'y',
            },
            {
              label: 'Bonds',
              data: projection.years.map((y) => y.bonds),
              borderColor: '#64748b',
              tension: 0.2,
              pointRadius: 0,
              borderWidth: 1.5,
              yAxisID: 'y',
            },
            {
              label: 'Crypto',
              data: projection.years.map((y) => y.crypto),
              borderColor: '#ca8a04',
              tension: 0.2,
              pointRadius: 0,
              borderWidth: 1.5,
              yAxisID: 'y',
            },
            {
              label: 'Bitcoin',
              data: projection.years.map((y) => y.bitcoin),
              borderColor: '#f59e0b',
              tension: 0.2,
              pointRadius: 0,
              borderWidth: 1.5,
              yAxisID: 'y',
            },
            {
              label: 'Gold',
              data: projection.years.map((y) => y.gold ?? 0),
              borderColor: '#a16207',
              tension: 0.2,
              pointRadius: 0,
              borderWidth: 1.5,
              yAxisID: 'y',
            },
            {
              label: 'Silver',
              data: projection.years.map((y) => y.silver ?? 0),
              borderColor: '#94a3b8',
              tension: 0.2,
              pointRadius: 0,
              borderWidth: 1.5,
              yAxisID: 'y',
            },
            {
              label: 'Expenses',
              data: projection.years.map((y) => y.expenses),
              borderColor: '#dc2626',
              borderDash: [6, 4],
              tension: 0.2,
              pointRadius: 0,
              borderWidth: 1.5,
              yAxisID: 'y1',
            },
            {
              label: 'Income + SS',
              data: projection.years.map((y) => y.income + y.socialSecurity),
              borderColor: '#16a34a',
              borderDash: [6, 4],
              tension: 0.2,
              pointRadius: 0,
              borderWidth: 1.5,
              yAxisID: 'y1',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              labels: { color: tickColor, boxWidth: 12, font: { size: 11 } },
            },
            tooltip: {
              callbacks: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                label(ctx: any) {
                  const v = ctx.parsed.y;
                  return `${ctx.dataset.label}: ${money(v ?? 0)}`;
                },
              },
            },
          },
          scales: {
            x: {
              title: { display: true, text: 'Age', color: tickColor },
              ticks: { color: tickColor, maxTicksLimit: 16 },
              grid: { color: grid },
            },
            y: {
              position: 'left',
              title: { display: true, text: 'Portfolio ($)', color: tickColor },
              ticks: {
                color: tickColor,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                callback: (v: any) => '$' + Number(v).toLocaleString(),
              },
              grid: { color: grid },
            },
            y1: {
              position: 'right',
              title: { display: true, text: 'Cashflow ($/yr)', color: tickColor },
              ticks: {
                color: tickColor,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                callback: (v: any) => '$' + Number(v).toLocaleString(),
              },
              grid: { drawOnChartArea: false },
            },
          },
        },
        plugins: [annotationPlugin],
      };

      chart = new Chart(canvasEl, config);
      chart.$projection = projection;
    } catch (e) {
      chartError = e instanceof Error ? e.message : 'Chart failed to render';
    }
  }

  onDestroy(() => {
    chart?.destroy();
    chart = null;
  });
</script>

<PlannerPanel
  title="Projection"
  description="Deterministic year-by-year path with your strategies applied: down-year spending cuts, cash-first withdrawals, and Roth conversions in the pre–Social Security gap."
>
  <svelte:fragment slot="actions">
    <button type="button" class="btn-primary mt-3" on:click={refresh}>Refresh</button>
  </svelte:fragment>

  {#if !planReady}
    <EmptyState
      title="More inputs needed"
      message="Add accounts with balances and define spending (expenses or withdrawal rate) before the projection is meaningful."
    />
  {:else if projectionError}
    <p role="alert" class="text-sm text-red-600 dark:text-red-400">{projectionError}</p>
  {:else if result}
    {#if result.warnings.length}
      <ul class="space-y-1">
        {#each result.warnings as w}
          <li
            class="text-sm rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-amber-900 dark:text-amber-100"
          >
            {w}
          </li>
        {/each}
      </ul>
    {/if}

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <p class="text-xs uppercase tracking-wide text-gray-500">Ending balance</p>
        <p class="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
          {money(result.endingBalance)}
        </p>
        <p class="text-xs text-gray-500 mt-1">At age {result.maxAge}</p>
      </div>
      <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <p class="text-xs uppercase tracking-wide text-gray-500">Portfolio depleted</p>
        <p class="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
          {result.depletedAge != null ? `Age ${result.depletedAge}` : 'Never'}
        </p>
        <p class="text-xs text-gray-500 mt-1">Within plan horizon</p>
      </div>
      <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <p class="text-xs uppercase tracking-wide text-gray-500">Primary RMD age</p>
        <p class="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
          {result.primaryRmdAge}
        </p>
        <p class="text-xs text-gray-500 mt-1">SECURE 2.0 estimate</p>
      </div>
      <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <p class="text-xs uppercase tracking-wide text-gray-500">Spouse RMD age</p>
        <p class="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
          {result.spouseRmdAge ?? '—'}
        </p>
        <p class="text-xs text-gray-500 mt-1">
          {$planStore.filingStatus === 'married' ? 'Based on spouse age' : 'Single filing'}
        </p>
      </div>
      <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <p class="text-xs uppercase tracking-wide text-gray-500">Roth conversions</p>
        <p class="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
          {money(result.totalRothConverted)}
        </p>
        <p class="text-xs text-gray-500 mt-1">Lifetime Traditional → Roth</p>
      </div>
      <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <p class="text-xs uppercase tracking-wide text-gray-500">Down-year cuts</p>
        <p class="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
          {money(result.totalExpenseCuts)}
        </p>
        <p class="text-xs text-gray-500 mt-1">Spending held back in negative years</p>
      </div>
    </div>

    {#if $planStore.accounts.some((a) => ['bitcoin', 'crypto', 'gold', 'silver'].includes(a.type))}
      <div class="rounded-lg border border-amber-200 dark:border-amber-800 p-4 text-sm">
        <p class="font-semibold">BTC/crypto → cash: {money(result.totalCryptoHarvested)} after estimated sale tax</p>
        <p class="mt-1 text-gray-500">
          {result.years.filter((y) => y.athHarvest).length} near-ATH harvest year{result.years.filter((y) => y.athHarvest).length === 1 ? '' : 's'},
          {result.years.filter((y) => y.altTrim).length} balanced-trim year{result.years.filter((y) => y.altTrim).length === 1 ? '' : 's'}.
          The year table shows the projected Bitcoin price, cash raised, and the reason for each sale.
        </p>
      </div>
    {/if}
    {#if result.simulationMeta}
      <p class="text-xs text-gray-500 dark:text-gray-400">
        Engine {result.simulationMeta.engineVersion} · tax pack {result.simulationMeta.taxLawPackId}
        · policy {result.simulationMeta.policyPackId}
      </p>
    {/if}

    {#if chartError}
      <p class="text-sm text-red-600 dark:text-red-400">{chartError}</p>
    {/if}

    <div
      class="h-[360px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-3"
    >
      <canvas bind:this={canvasEl}></canvas>
    </div>

    <div class="flex items-center justify-between">
      <p class="text-xs text-gray-500 dark:text-gray-400">
        Dashed vertical markers: retirement and RMD start. Withdrawal order: cash/HYSA → CD →
        bonds → brokerage → gold → silver → traditional → Roth → crypto → Bitcoin (last).
      </p>
      <button
        type="button"
        class="text-sm text-primary-600 dark:text-primary-400 hover:underline"
        on:click={() => (showTable = !showTable)}
      >
        {showTable ? 'Hide' : 'Show'} year table
      </button>
    </div>

    {#if showTable}
      <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto">
        <table class="min-w-full text-xs sm:text-sm">
          <thead class="sticky top-0 bg-gray-50 dark:bg-gray-800 text-left text-gray-600 dark:text-gray-400">
            <tr>
              <th class="px-2 py-2 font-medium">Age</th>
              <th class="px-2 py-2 font-medium">Portfolio</th>
              <th class="px-2 py-2 font-medium">Income</th>
              <th class="px-2 py-2 font-medium">SS</th>
              <th class="px-2 py-2 font-medium">Expenses</th>
              <th class="px-2 py-2 font-medium">Withdraw</th>
              <th class="px-2 py-2 font-medium">RMD</th>
              <th class="px-2 py-2 font-medium">Roth conv.</th>
              <th class="px-2 py-2 font-medium">Shortfall</th>
              <th class="px-2 py-2 font-medium">BTC price</th>
              <th class="px-2 py-2 font-medium">Harvest → cash</th>
              <th class="px-2 py-2 font-medium">Tax est.</th>
              <th class="px-2 py-2 font-medium">Decisions</th>
            </tr>
          </thead>
          <tbody>
            {#each result.years as y}
              <tr
                class="border-t border-gray-200 dark:border-gray-700 {y.primaryRmdStarts ||
                y.spouseRmdStarts
                  ? 'bg-amber-50/80 dark:bg-amber-950/20'
                  : y.isRetired
                    ? ''
                    : 'opacity-90'}"
              >
                <td class="px-2 py-1.5 font-medium">{y.age}</td>
                <td class="px-2 py-1.5">{money(y.portfolioTotal)}</td>
                <td class="px-2 py-1.5">{money(y.income)}</td>
                <td class="px-2 py-1.5">{money(y.socialSecurity)}</td>
                <td class="px-2 py-1.5">{money(y.expenses)}</td>
                <td class="px-2 py-1.5">{money(y.withdrawals)}</td>
                <td class="px-2 py-1.5">{money(y.rmd)}</td>
                <td class="px-2 py-1.5">{y.rothConversion > 0 ? money(y.rothConversion) : '—'}</td>
                <td class="px-2 py-1.5 {y.shortfall > 0 ? 'text-red-600 dark:text-red-400' : ''}">
                  {y.shortfall > 0 ? money(y.shortfall) : '—'}
                </td>
                <td class="px-2 py-1.5">{y.bitcoinPriceUsd != null ? money(y.bitcoinPriceUsd) : '—'}</td>
                <td class="px-2 py-1.5 text-amber-700 dark:text-amber-300">{y.cryptoHarvestToCash > 0 ? money(y.cryptoHarvestToCash) : '—'}</td>
                <td class="px-2 py-1.5">{y.estimatedTax != null ? money(y.estimatedTax) : '—'}</td>
                <td class="px-2 py-1.5">
                  {#if y.events?.some((e) => ['AthHarvestSale', 'RothConversion', 'ExpenseCut', 'Rmd', 'SpendingWithdraw', 'TaxEstimate'].includes(e.kind))}
                    <button
                      type="button"
                      class="text-primary-600 dark:text-primary-400 hover:underline"
                      aria-expanded={expandedAge === y.age}
                      aria-label={'Decisions at age ' + y.age}
                      on:click={() => (expandedAge = expandedAge === y.age ? null : y.age)}
                    >
                      {expandedAge === y.age ? 'Hide' : 'Why?'}
                    </button>
                  {:else}
                    —
                  {/if}
                </td>
              </tr>
              {#if expandedAge === y.age && y.events}
                <tr class="border-t border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/50">
                  <td colspan="13" class="px-3 py-2">
                    <ul class="space-y-1 text-gray-600 dark:text-gray-400">
                      {#each y.events.filter((e) => e.kind !== 'Contribution' && e.kind !== 'MarketGrowth' && e.kind !== 'Income' && e.kind !== 'Expense' && e.kind !== 'SocialSecurity') as ev}
                        <li>{formatEventSummary(ev)}</li>
                      {/each}
                    </ul>
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</PlannerPanel>
