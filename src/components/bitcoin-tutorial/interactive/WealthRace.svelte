<script>
  import { onMount } from 'svelte';
  
  // Simulation parameters
  let initialPurchasingPower = 1000;
  let years = 10;
  let inflationRate = 7; // Annual inflation rate in percentage
  let btcAnnualGrowth = 25; // Annual BTC growth rate in percentage
  let dcaAmount = 100; // Monthly dollar-cost averaging amount
  
  // Calculated values
  let usdPurchasingPower = initialPurchasingPower;
  let btcValue = 0;
  let dcaUsdValue = 0;
  let dcaBtcValue = 0;
  
  // Chart data
  let chartData = [];
  let cumulativeDcaUsd = 0;
  
  // Calculate simulation results
  function calculateResults() {
    usdPurchasingPower = initialPurchasingPower;
    btcValue = initialPurchasingPower;
    dcaUsdValue = 0;
    dcaBtcValue = 0;
    cumulativeDcaUsd = 0;
    chartData = [];
    
    // Initial values
    chartData.push({
      year: 0,
      usdPurchasingPower: initialPurchasingPower,
      btcValue: initialPurchasingPower,
      dcaUsdValue: 0,
      dcaBtcValue: 0,
      cumulativeDcaUsd: 0
    });
    
    // Calculate for each year
    for (let year = 1; year <= years; year++) {
      // USD loses purchasing power due to inflation
      usdPurchasingPower *= (1 - (inflationRate / 100));
      
      // BTC grows in value
      btcValue *= (1 + (btcAnnualGrowth / 100));
      
      // DCA calculations
      const yearlyDcaAmount = dcaAmount * 12; // Monthly to yearly
      cumulativeDcaUsd += yearlyDcaAmount;
      
      // DCA in USD (also affected by inflation)
      dcaUsdValue = cumulativeDcaUsd * (1 - (inflationRate / 100) ** year);
      
      // DCA in BTC (simplified model)
      // This assumes buying throughout the year at average price
      let yearlyBtcGrowth = 1;
      for (let i = 0; i < year; i++) {
        yearlyBtcGrowth *= (1 + (btcAnnualGrowth / 100));
      }
      
      // Add this year's DCA contribution
      dcaBtcValue += yearlyDcaAmount * yearlyBtcGrowth / (1 + (btcAnnualGrowth / 100) ** (year - 0.5));
      
      // Store data for chart
      chartData.push({
        year,
        usdPurchasingPower,
        btcValue,
        dcaUsdValue,
        dcaBtcValue,
        cumulativeDcaUsd
      });
    }
  }
  
  // Initialize on component mount
  onMount(() => {
    calculateResults();
  });
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/20 p-6 border border-gray-200 dark:border-gray-700">
  <h2 class="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-gray-100">USD vs. BTC Wealth Preservation Race</h2>
  
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
    <div>
      <h3 class="font-semibold mb-4 text-gray-900 dark:text-gray-100">Simulation Parameters</h3>
      
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Initial Investment ($)
        </label>
        <input 
          type="number" 
          bind:value={initialPurchasingPower} 
          min="100" 
          max="100000" 
          step="100"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          on:change={calculateResults}
        />
      </div>
      
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Simulation Period (Years)
        </label>
        <input 
          type="range" 
          bind:value={years} 
          min="1" 
          max="20" 
          step="1"
          class="w-full accent-blue-500 dark:accent-blue-400"
          on:input={calculateResults}
        />
        <div class="text-right text-sm text-gray-600 dark:text-gray-400">{years} years</div>
      </div>
      
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Annual Inflation Rate (%)
        </label>
        <input 
          type="range" 
          bind:value={inflationRate} 
          min="1" 
          max="20" 
          step="0.5"
          class="w-full accent-blue-500 dark:accent-blue-400"
          on:input={calculateResults}
        />
        <div class="text-right text-sm text-gray-600 dark:text-gray-400">{inflationRate}%</div>
      </div>
      
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Bitcoin Annual Growth Rate (%)
        </label>
        <input 
          type="range" 
          bind:value={btcAnnualGrowth} 
          min="0" 
          max="100" 
          step="5"
          class="w-full accent-blue-500 dark:accent-blue-400"
          on:input={calculateResults}
        />
        <div class="text-right text-sm text-gray-600 dark:text-gray-400">{btcAnnualGrowth}%</div>
      </div>
      
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Monthly DCA Amount ($)
        </label>
        <input 
          type="number" 
          bind:value={dcaAmount} 
          min="10" 
          max="10000" 
          step="10"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          on:change={calculateResults}
        />
      </div>
    </div>
    
    <div>
      <h3 class="font-semibold mb-4 text-gray-900 dark:text-gray-100">Results After {years} Years</h3>
      
      <div class="space-y-4">
        <div class="p-4 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">
          <div class="text-sm text-gray-600 dark:text-gray-400">USD Purchasing Power</div>
          <div class="text-xl font-bold text-gray-900 dark:text-gray-100">${usdPurchasingPower.toFixed(2)}</div>
          <div class="text-sm text-red-600 dark:text-red-400">
            {((usdPurchasingPower / initialPurchasingPower - 1) * 100).toFixed(2)}% change
          </div>
        </div>
        
        <div class="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-md border border-orange-200 dark:border-orange-800">
          <div class="text-sm text-gray-600 dark:text-gray-400">USD with Dollar-Cost Averaging</div>
          <div class="text-xl font-bold text-gray-900 dark:text-gray-100">${dcaUsdValue.toFixed(2)}</div>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            Total invested: ${cumulativeDcaUsd.toFixed(2)}
          </div>
        </div>
        
        <div class="p-4 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
          <div class="text-sm text-gray-600 dark:text-gray-400">BTC Lump Sum Value</div>
          <div class="text-xl font-bold text-gray-900 dark:text-gray-100">${btcValue.toFixed(2)}</div>
          <div class="text-sm text-green-600 dark:text-green-400">
            {((btcValue / initialPurchasingPower - 1) * 100).toFixed(2)}% change
          </div>
        </div>
        
        <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
          <div class="text-sm text-gray-600 dark:text-gray-400">BTC with Dollar-Cost Averaging</div>
          <div class="text-xl font-bold text-gray-900 dark:text-gray-100">${dcaBtcValue.toFixed(2)}</div>
          <div class="text-sm text-blue-600 dark:text-blue-400">
            {((dcaBtcValue / cumulativeDcaUsd - 1) * 100).toFixed(2)}% return on investment
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <div class="mt-8 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
    <h3 class="font-bold text-lg mb-2 text-gray-900 dark:text-gray-100">Key Insights</h3>
    <ul class="space-y-2 text-gray-700 dark:text-gray-300">
      <li>
        <strong>Inflation Impact:</strong> At {inflationRate}% annual inflation, USD purchasing power 
        decreases by {((1 - usdPurchasingPower / initialPurchasingPower) * 100).toFixed(2)}% over {years} years.
      </li>
      <li>
        <strong>Bitcoin Growth:</strong> With {btcAnnualGrowth}% annual growth, a $1,000 investment 
        becomes ${btcValue.toFixed(2)} after {years} years.
      </li>
      <li>
        <strong>DCA Strategy:</strong> Dollar-cost averaging $100 monthly into Bitcoin yields 
        ${dcaBtcValue.toFixed(2)} from a total investment of ${cumulativeDcaUsd.toFixed(2)}.
      </li>
      <li>
        <strong>Volatility Consideration:</strong> This simulation uses average annual growth and doesn't 
        show Bitcoin's short-term volatility, which can be significant.
      </li>
    </ul>
  </div>
</div>
