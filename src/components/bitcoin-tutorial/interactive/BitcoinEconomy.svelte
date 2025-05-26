<script>
  import { onMount } from 'svelte';
  
  // Simulation parameters
  let years = 20; // Simulation period
  let savingsRate = 15; // Percentage of income saved
  let productivityGrowth = 2; // Annual productivity growth (%)
  let timePreference = 20; // Time preference (higher = more present-oriented)
  
  // Economic indicators
  let gdpGrowth = 3; // Annual GDP growth (%)
  let capitalFormation = 100; // Index of capital formation
  let innovationRate = 100; // Index of innovation
  let consumerGoods = 100; // Index of consumer goods production
  let capitalGoods = 100; // Index of capital goods production
  
  // Simulation results
  let simulationResults = [];
  let currentYear = 0;
  
  // Simulation state
  let isSimulationRunning = false;
  let simulationInterval;
  let simulationSpeed = 1; // Years per step
  
  // Start the simulation
  function startSimulation() {
    if (!isSimulationRunning) {
      resetSimulation();
      isSimulationRunning = true;
      simulationInterval = setInterval(advanceSimulation, 1000 / simulationSpeed);
    }
  }
  
  // Pause the simulation
  function pauseSimulation() {
    isSimulationRunning = false;
    clearInterval(simulationInterval);
  }
  
  // Reset the simulation
  function resetSimulation() {
    pauseSimulation();
    currentYear = 0;
    gdpGrowth = 3;
    capitalFormation = 100;
    innovationRate = 100;
    consumerGoods = 100;
    capitalGoods = 100;
    simulationResults = [{
      year: currentYear,
      gdpGrowth,
      capitalFormation,
      innovationRate,
      consumerGoods,
      capitalGoods,
      savingsRate,
      timePreference
    }];
  }
  
  // Advance the simulation by one year
  function advanceSimulation() {
    currentYear += 1;
    
    // Calculate economic effects based on savings rate and time preference
    const effectiveSavingsRate = savingsRate * (100 - timePreference) / 100;
    
    // Update economic indicators
    capitalFormation = capitalFormation * (1 + (effectiveSavingsRate - 15) / 100);
    innovationRate = innovationRate * (1 + (capitalFormation / 100 - 1) * 0.5);
    gdpGrowth = productivityGrowth + (effectiveSavingsRate - 15) / 10;
    
    // Update production indices
    capitalGoods = capitalGoods * (1 + (effectiveSavingsRate - 15) / 200);
    consumerGoods = consumerGoods * (1 + gdpGrowth / 100);
    
    // Add random variations
    gdpGrowth += (Math.random() - 0.5) * 0.5;
    innovationRate += (Math.random() - 0.5) * 2;
    
    // Record results
    simulationResults.push({
      year: currentYear,
      gdpGrowth,
      capitalFormation,
      innovationRate,
      consumerGoods,
      capitalGoods,
      savingsRate,
      timePreference
    });
    
    // End simulation if reached target years
    if (currentYear >= years) {
      pauseSimulation();
    }
  }
  
  // Calculate compound growth over the simulation period
  function calculateCompoundGrowth(initialValue, growthRate, years) {
    return initialValue * Math.pow(1 + growthRate / 100, years);
  }
  
  // Get the latest simulation result
  $: latestResult = simulationResults[simulationResults.length - 1] || {
    year: 0,
    gdpGrowth: 3,
    capitalFormation: 100,
    innovationRate: 100,
    consumerGoods: 100,
    capitalGoods: 100
  };
  
  // Calculate final GDP after simulation
  $: finalGDP = calculateCompoundGrowth(100, gdpGrowth, currentYear);
  
  onMount(() => {
    // Initialize simulation results
    simulationResults = [{
      year: currentYear,
      gdpGrowth,
      capitalFormation,
      innovationRate,
      consumerGoods,
      capitalGoods,
      savingsRate,
      timePreference
    }];
    
    // Cleanup on component destruction
    return () => {
      if (simulationInterval) clearInterval(simulationInterval);
    };
  });
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/20 p-6 border border-gray-200 dark:border-gray-700">
  <h2 class="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-gray-100">Bitcoin Economic System Simulation</h2>
  
  <div class="mb-8">
    <p class="text-gray-700 dark:text-gray-300 mb-4">
      Explore how a Bitcoin-based economy with fixed money supply might function compared to a fiat system.
      Adjust parameters to see how savings, time preference, and productivity affect long-term economic outcomes.
    </p>
  </div>

  <!-- Simulation Controls -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
    <!-- Left Column: Parameters -->
    <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
      <h3 class="font-semibold mb-4 text-gray-900 dark:text-gray-100">Simulation Parameters</h3>
      
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Savings Rate: {savingsRate}%
          </label>
          <input 
            type="range" 
            min="5" 
            max="40" 
            bind:value={savingsRate} 
            class="w-full accent-blue-500 dark:accent-blue-400"
            disabled={isSimulationRunning}
          />
          <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Low Savings</span>
            <span>High Savings</span>
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Time Preference: {timePreference}
          </label>
          <input 
            type="range" 
            min="5" 
            max="50" 
            bind:value={timePreference} 
            class="w-full accent-blue-500 dark:accent-blue-400"
            disabled={isSimulationRunning}
          />
          <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Future-Oriented</span>
            <span>Present-Oriented</span>
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Productivity Growth: {productivityGrowth}%
          </label>
          <input 
            type="range" 
            min="0.5" 
            max="5" 
            step="0.5"
            bind:value={productivityGrowth} 
            class="w-full accent-blue-500 dark:accent-blue-400"
            disabled={isSimulationRunning}
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Simulation Period: {years} years
          </label>
          <input 
            type="range" 
            min="10" 
            max="50" 
            step="5"
            bind:value={years} 
            class="w-full accent-blue-500 dark:accent-blue-400"
            disabled={isSimulationRunning}
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Simulation Speed
          </label>
          <input 
            type="range" 
            min="1" 
            max="5" 
            bind:value={simulationSpeed} 
            class="w-full accent-blue-500 dark:accent-blue-400"
          />
          <div class="text-right text-xs text-gray-500 dark:text-gray-400">{simulationSpeed}x</div>
        </div>
      </div>
      
      <div class="flex space-x-4 mt-6">
        {#if isSimulationRunning}
          <button 
            class="flex-1 py-2 bg-yellow-500 dark:bg-yellow-600 text-white rounded hover:bg-yellow-600 dark:hover:bg-yellow-700 transition-colors"
            on:click={pauseSimulation}
          >
            Pause
          </button>
        {:else}
          <button 
            class="flex-1 py-2 bg-green-500 dark:bg-green-600 text-white rounded hover:bg-green-600 dark:hover:bg-green-700 transition-colors"
            on:click={startSimulation}
          >
            Start
          </button>
        {/if}
        
        <button 
          class="flex-1 py-2 bg-red-500 dark:bg-red-600 text-white rounded hover:bg-red-600 dark:hover:bg-red-700 transition-colors"
          on:click={resetSimulation}
        >
          Reset
        </button>
      </div>
    </div>
    
    <!-- Right Column: Results -->
    <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-semibold text-gray-900 dark:text-gray-100">Simulation Results</h3>
        <div class="text-sm text-gray-600 dark:text-gray-400">Year: {currentYear} / {years}</div>
      </div>
      
      <div class="space-y-3">
        <div>
          <div class="flex justify-between mb-1">
            <span class="text-sm text-gray-700 dark:text-gray-300">GDP Growth Rate</span>
            <span class="text-sm font-medium text-green-600 dark:text-green-400">{latestResult.gdpGrowth.toFixed(1)}%</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
            <div class="bg-green-500 dark:bg-green-400 h-2 rounded-full" 
                 style={`width: ${Math.min(100, Math.max(0, latestResult.gdpGrowth * 10))}%`}></div>
          </div>
        </div>
        
        <div>
          <div class="flex justify-between mb-1">
            <span class="text-sm text-gray-700 dark:text-gray-300">Capital Formation Index</span>
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{latestResult.capitalFormation.toFixed(1)}</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
            <div class="bg-blue-500 dark:bg-blue-400 h-2 rounded-full" 
                 style={`width: ${Math.min(100, latestResult.capitalFormation / 2)}%`}></div>
          </div>
        </div>
        
        <div>
          <div class="flex justify-between mb-1">
            <span class="text-sm text-gray-700 dark:text-gray-300">Innovation Rate Index</span>
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{latestResult.innovationRate.toFixed(1)}</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
            <div class="bg-purple-500 dark:bg-purple-400 h-2 rounded-full" 
                 style={`width: ${Math.min(100, latestResult.innovationRate / 2)}%`}></div>
          </div>
        </div>
        
        <div class="grid grid-cols-2 gap-4 mt-4">
          <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-800">
            <div class="text-sm text-gray-700 dark:text-gray-300">Consumer Goods</div>
            <div class="text-lg font-semibold text-gray-900 dark:text-gray-100">{latestResult.consumerGoods.toFixed(1)}</div>
          </div>
          
          <div class="bg-green-50 dark:bg-green-900/20 p-3 rounded border border-green-200 dark:border-green-800">
            <div class="text-sm text-gray-700 dark:text-gray-300">Capital Goods</div>
            <div class="text-lg font-semibold text-gray-900 dark:text-gray-100">{latestResult.capitalGoods.toFixed(1)}</div>
          </div>
        </div>
        
        <div class="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded mt-4 border border-yellow-200 dark:border-yellow-800">
          <div class="text-sm text-gray-700 dark:text-gray-300">Cumulative GDP Growth</div>
          <div class="text-lg font-semibold text-gray-900 dark:text-gray-100">{finalGDP.toFixed(1)}%</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            (Starting from base of 100)
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Simulation Timeline -->
  {#if simulationResults.length > 1}
    <div class="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 rounded-lg mb-6">
      <h3 class="font-semibold mb-3 text-gray-900 dark:text-gray-100">Economic Trends</h3>
      
      <div class="h-40 bg-gray-50 dark:bg-gray-700 relative">
        <!-- GDP Growth Line -->
        <div class="absolute top-0 left-0 right-0 bottom-0 flex items-end">
          {#each simulationResults as result, i}
            {#if i > 0}
              <div 
                class="w-full h-full flex-1 flex items-end"
                style={`height: 100%`}
              >
                <div 
                  class="w-full bg-green-500 dark:bg-green-400"
                  style={`height: ${Math.min(100, Math.max(0, result.gdpGrowth * 10))}%`}
                ></div>
              </div>
            {/if}
          {/each}
        </div>
        
        <!-- Capital Formation Line (overlay) -->
        <div class="absolute top-0 left-0 right-0 bottom-0 flex">
          {#each simulationResults as result, i}
            {#if i > 0}
              <div 
                class="w-full h-full flex-1 flex items-end pointer-events-none"
              >
                <div 
                  class="w-1 h-1 rounded-full bg-blue-500 dark:bg-blue-400 transform -translate-x-1/2"
                  style={`margin-bottom: ${Math.min(100, result.capitalFormation / 2)}%`}
                ></div>
              </div>
            {/if}
          {/each}
        </div>
      </div>
      
      <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
        <span>Year 0</span>
        <span>Year {currentYear}</span>
      </div>
      
      <div class="flex space-x-4 mt-2 text-xs">
        <div class="flex items-center">
          <div class="w-3 h-3 bg-green-500 dark:bg-green-400 mr-1"></div>
          <span class="text-gray-700 dark:text-gray-300">GDP Growth</span>
        </div>
        <div class="flex items-center">
          <div class="w-3 h-3 bg-blue-500 dark:bg-blue-400 mr-1"></div>
          <span class="text-gray-700 dark:text-gray-300">Capital Formation</span>
        </div>
      </div>
    </div>
  {/if}
  
  <div class="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
    <h3 class="font-bold text-lg mb-2 text-blue-900 dark:text-blue-100">Key Insights</h3>
    <p class="text-blue-800 dark:text-blue-200">
      In a Bitcoin-based economy with fixed money supply, several important dynamics emerge:
    </p>
    <ul class="list-disc pl-5 mt-2 space-y-1 text-blue-800 dark:text-blue-200">
      <li>
        <strong>Higher savings rates</strong> lead to more capital formation, which drives innovation and productivity.
      </li>
      <li>
        <strong>Lower time preference</strong> (more future-oriented thinking) increases effective savings and investment.
      </li>
      <li>
        As productivity increases, prices naturally <strong>decrease over time</strong>, increasing purchasing power.
      </li>
      <li>
        The economy shifts toward more <strong>capital goods production</strong>, creating a foundation for sustainable growth.
      </li>
    </ul>
    <p class="mt-2 text-blue-800 dark:text-blue-200">
      Unlike fiat systems that encourage consumption and debt through inflation, a Bitcoin standard would reward saving
      and long-term thinking, potentially leading to more sustainable economic development.
    </p>
  </div>
</div>
