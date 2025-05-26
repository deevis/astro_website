<script>
  import { onMount } from 'svelte';
  
  // Simulation parameters
  let adoptionRate = 5; // Annual adoption growth rate (%)
  let monetizationRate = 2; // Bitcoin price growth multiplier
  let selectedScenario = 'store-of-value'; // Default scenario
  let simulationYears = 10; // Years to simulate
  
  // Adoption metrics
  let users = 200; // Million users (starting value)
  let marketCap = 1; // Trillion USD (starting value)
  let bitcoinPrice = 50000; // USD per bitcoin (starting value)
  let globalGdp = 100; // Trillion USD (starting value)
  let bitcoinShare = 1; // % of global financial assets (starting value)
  
  // Scenario definitions
  const scenarios = [
    {
      id: 'store-of-value',
      name: 'Digital Gold',
      description: 'Bitcoin primarily serves as a store of value and inflation hedge, similar to gold.',
      adoptionRate: 5,
      monetizationRate: 2,
      endState: {
        users: 500,
        marketCap: 5,
        bitcoinShare: 5
      }
    },
    {
      id: 'settlement-layer',
      name: 'Global Settlement Layer',
      description: 'Bitcoin becomes the foundation for international settlements between banks, companies, and countries.',
      adoptionRate: 10,
      monetizationRate: 3,
      endState: {
        users: 1000,
        marketCap: 10,
        bitcoinShare: 10
      }
    },
    {
      id: 'medium-of-exchange',
      name: 'Medium of Exchange',
      description: 'Lightning Network and other scaling solutions enable Bitcoin to be used for everyday transactions.',
      adoptionRate: 15,
      monetizationRate: 4,
      endState: {
        users: 2000,
        marketCap: 20,
        bitcoinShare: 20
      }
    },
    {
      id: 'reserve-currency',
      name: 'World Reserve Currency',
      description: 'Bitcoin challenges the US Dollar as the global reserve currency.',
      adoptionRate: 20,
      monetizationRate: 5,
      endState: {
        users: 4000,
        marketCap: 50,
        bitcoinShare: 50
      }
    }
  ];
  
  // Simulation results
  let simulationResults = [];
  let currentYear = 0;
  
  // Simulation state
  let isSimulationRunning = false;
  let simulationInterval;
  let simulationSpeed = 1; // Years per step
  
  // Current simulation result values - these will be updated reactively
  let currentUsers = 200;
  let currentMarketCap = 1;
  let currentBitcoinPrice = 50000;
  let currentGlobalGdp = 100;
  let currentBitcoinShare = 1;
  let currentProgress = 20;
  
  // Select a predefined scenario
  function selectScenario(scenarioId) {
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (scenario) {
      selectedScenario = scenarioId;
      adoptionRate = scenario.adoptionRate;
      monetizationRate = scenario.monetizationRate;
    }
  }
  
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
    users = 200;
    marketCap = 1;
    bitcoinPrice = 50000;
    globalGdp = 100;
    bitcoinShare = 1;
    
    // Reset current values for display
    currentUsers = users;
    currentMarketCap = marketCap;
    currentBitcoinPrice = bitcoinPrice;
    currentGlobalGdp = globalGdp;
    currentBitcoinShare = bitcoinShare;
    updateProgress();
    
    simulationResults = [{
      year: currentYear,
      users,
      marketCap,
      bitcoinPrice,
      globalGdp,
      bitcoinShare
    }];
  }
  
  // Update progress toward selected scenario
  function updateProgress() {
    const scenario = scenarios.find(s => s.id === selectedScenario);
    if (scenario) {
      currentProgress = Math.min(100, (currentBitcoinShare / scenario.endState.bitcoinShare) * 100);
    }
  }
  
  // Advance the simulation by one year
  function advanceSimulation() {
    currentYear += 1;
    
    // Update adoption metrics based on scenario parameters
    users = users * (1 + adoptionRate / 100);
    globalGdp = globalGdp * 1.03; // Assume 3% annual global GDP growth
    
    // Bitcoin market cap grows with adoption and monetization
    marketCap = marketCap * (1 + (adoptionRate * monetizationRate) / 100);
    
    // Calculate bitcoin price based on market cap (assuming 21 million total supply)
    bitcoinPrice = (marketCap * 1e12) / 21e6;
    
    // Calculate bitcoin's share of global financial assets
    // Global financial assets are roughly 4x global GDP
    bitcoinShare = (marketCap / (globalGdp * 4)) * 100;
    
    // Update current values for display
    currentUsers = users;
    currentMarketCap = marketCap;
    currentBitcoinPrice = bitcoinPrice;
    currentGlobalGdp = globalGdp;
    currentBitcoinShare = bitcoinShare;
    updateProgress();
    
    // Record results
    simulationResults.push({
      year: currentYear,
      users,
      marketCap,
      bitcoinPrice,
      globalGdp,
      bitcoinShare
    });
    
    // End simulation if reached target years
    if (currentYear >= simulationYears) {
      pauseSimulation();
    }
  }
  
  // Get the selected scenario
  $: selectedScenarioObj = scenarios.find(s => s.id === selectedScenario);
  
  onMount(() => {
    // Initialize simulation results
    simulationResults = [{
      year: currentYear,
      users,
      marketCap,
      bitcoinPrice,
      globalGdp,
      bitcoinShare
    }];
    
    // Initialize current values
    currentUsers = users;
    currentMarketCap = marketCap;
    currentBitcoinPrice = bitcoinPrice;
    currentGlobalGdp = globalGdp;
    currentBitcoinShare = bitcoinShare;
    updateProgress();
    
    // Cleanup on component destruction
    return () => {
      if (simulationInterval) clearInterval(simulationInterval);
    };
  });
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/20 p-6 border border-gray-200 dark:border-gray-700">
  <h2 class="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-gray-100">Bitcoin Future Adoption Scenarios</h2>
  
  <div class="mb-8">
    <p class="text-gray-700 dark:text-gray-300 mb-4">
      Explore different potential futures for Bitcoin adoption over the next decade.
      Select a scenario or customize parameters to see how adoption metrics might evolve.
    </p>
  </div>

  <!-- Scenario Selection -->
  <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-8">
    {#each scenarios as scenario}
      <button 
        class={`p-4 rounded-lg border-2 transition-colors ${selectedScenario === scenario.id ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'}`}
        on:click={() => selectScenario(scenario.id)}
        disabled={isSimulationRunning}
      >
        <div class="font-semibold mb-1 text-gray-900 dark:text-gray-100">{scenario.name}</div>
        <div class="text-xs text-gray-500 dark:text-gray-400">{scenario.description}</div>
      </button>
    {/each}
  </div>

  <!-- Simulation Controls -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
    <!-- Left Column: Parameters -->
    <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
      <h3 class="font-semibold mb-4 text-gray-900 dark:text-gray-100">Simulation Parameters</h3>
      
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Annual Adoption Growth: {adoptionRate}%
          </label>
          <input 
            type="range" 
            min="1" 
            max="30" 
            bind:value={adoptionRate} 
            class="w-full accent-blue-500 dark:accent-blue-400"
            disabled={isSimulationRunning}
          />
          <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Slow</span>
            <span>Rapid</span>
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Monetization Factor: {monetizationRate}x
          </label>
          <input 
            type="range" 
            min="1" 
            max="10" 
            bind:value={monetizationRate} 
            class="w-full accent-blue-500 dark:accent-blue-400"
            disabled={isSimulationRunning}
          />
          <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Linear</span>
            <span>Exponential</span>
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Simulation Period: {simulationYears} years
          </label>
          <input 
            type="range" 
            min="5" 
            max="20" 
            step="5"
            bind:value={simulationYears} 
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
        <div class="text-sm text-gray-600 dark:text-gray-400">Year: {currentYear} / {simulationYears}</div>
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-800">
          <div class="text-sm text-gray-700 dark:text-gray-300">Bitcoin Users</div>
          <div class="text-lg font-semibold text-gray-900 dark:text-gray-100">{currentUsers.toFixed(0)} million</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            {((currentUsers / 8000) * 100).toFixed(1)}% of global population
          </div>
        </div>
        
        <div class="bg-green-50 dark:bg-green-900/20 p-3 rounded border border-green-200 dark:border-green-800">
          <div class="text-sm text-gray-700 dark:text-gray-300">Market Cap</div>
          <div class="text-lg font-semibold text-gray-900 dark:text-gray-100">${currentMarketCap.toFixed(1)} trillion</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            {currentBitcoinShare.toFixed(1)}% of global financial assets
          </div>
        </div>
        
        <div class="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200 dark:border-yellow-800">
          <div class="text-sm text-gray-700 dark:text-gray-300">Bitcoin Price</div>
          <div class="text-lg font-semibold text-gray-900 dark:text-gray-100">${(currentBitcoinPrice / 1000).toFixed(0)}k</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            {((currentBitcoinPrice / 50000) - 1) * 100 > 0 ? '+' : ''}{(((currentBitcoinPrice / 50000) - 1) * 100).toFixed(0)}% from start
          </div>
        </div>
        
        <div class="bg-purple-50 dark:bg-purple-900/20 p-3 rounded border border-purple-200 dark:border-purple-800">
          <div class="text-sm text-gray-700 dark:text-gray-300">Global GDP</div>
          <div class="text-lg font-semibold text-gray-900 dark:text-gray-100">${currentGlobalGdp.toFixed(0)} trillion</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            Bitcoin is {(currentMarketCap / currentGlobalGdp * 100).toFixed(1)}% of global GDP
          </div>
        </div>
      </div>
      
      <div class="mt-4">
        <div class="flex justify-between mb-1">
          <span class="text-sm text-gray-700 dark:text-gray-300">Progress Toward {selectedScenarioObj.name} Scenario</span>
        </div>
        <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
          <div class="bg-blue-600 dark:bg-blue-500 h-2.5 rounded-full" 
               style={`width: ${currentProgress}%`}></div>
        </div>
        <div class="text-right text-xs text-gray-500 dark:text-gray-400 mt-1">
          {currentProgress.toFixed(0)}% complete
        </div>
      </div>
    </div>
  </div>
  
  <!-- Simulation Timeline -->
  {#if simulationResults.length > 1}
    <div class="bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700 rounded-lg mb-6">
      <h3 class="font-semibold mb-3 text-gray-900 dark:text-gray-100">Adoption Trends</h3>
      
      <div class="h-40 bg-gray-50 dark:bg-gray-700 relative">
        <!-- Price Line -->
        <div class="absolute top-0 left-0 right-0 bottom-0 flex items-end">
          {#each simulationResults as result, i}
            {#if i > 0}
              <div 
                class="w-full h-full flex-1 flex items-end"
                style={`height: 100%`}
              >
                <div 
                  class="w-full bg-yellow-500 dark:bg-yellow-400"
                  style={`height: ${Math.min(100, (result.bitcoinPrice / 1000000) * 100)}%`}
                ></div>
              </div>
            {/if}
          {/each}
        </div>
        
        <!-- User Adoption Line (overlay) -->
        <div class="absolute top-0 left-0 right-0 bottom-0 flex">
          {#each simulationResults as result, i}
            {#if i > 0}
              <div 
                class="w-full h-full flex-1 flex items-end pointer-events-none"
              >
                <div 
                  class="w-1 h-1 rounded-full bg-blue-500 dark:bg-blue-400 transform -translate-x-1/2"
                  style={`margin-bottom: ${Math.min(100, (result.users / 4000) * 100)}%`}
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
          <div class="w-3 h-3 bg-yellow-500 dark:bg-yellow-400 mr-1"></div>
          <span class="text-gray-700 dark:text-gray-300">Bitcoin Price</span>
        </div>
        <div class="flex items-center">
          <div class="w-3 h-3 bg-blue-500 dark:bg-blue-400 mr-1"></div>
          <span class="text-gray-700 dark:text-gray-300">User Adoption</span>
        </div>
      </div>
    </div>
  {/if}
  
  <div class="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
    <h3 class="font-bold text-lg mb-2 text-blue-900 dark:text-blue-100">Scenario Implications</h3>
    
    {#if selectedScenario === 'store-of-value'}
      <p class="text-blue-800 dark:text-blue-200">
        In the <strong>Digital Gold</strong> scenario, Bitcoin primarily competes with gold and other store-of-value assets.
        This represents the most conservative adoption path, but still implies significant growth from current levels.
      </p>
      <p class="mt-2 text-blue-800 dark:text-blue-200">
        Key implications include:
      </p>
      <ul class="list-disc pl-5 mt-1 space-y-1 text-blue-800 dark:text-blue-200">
        <li>Bitcoin becomes a standard part of institutional portfolios</li>
        <li>Central banks begin to hold small bitcoin reserves</li>
        <li>Bitcoin remains primarily an investment rather than a medium of exchange</li>
      </ul>
    {:else if selectedScenario === 'settlement-layer'}
      <p class="text-blue-800 dark:text-blue-200">
        In the <strong>Global Settlement Layer</strong> scenario, Bitcoin becomes the foundation for international
        settlements between banks, companies, and eventually countries.
      </p>
      <p class="mt-2 text-blue-800 dark:text-blue-200">
        Key implications include:
      </p>
      <ul class="list-disc pl-5 mt-1 space-y-1 text-blue-800 dark:text-blue-200">
        <li>Major reduction in settlement times and costs for international transfers</li>
        <li>Decreased reliance on correspondent banking networks</li>
        <li>Potential disruption of the SWIFT system and similar settlement networks</li>
      </ul>
    {:else if selectedScenario === 'medium-of-exchange'}
      <p class="text-blue-800 dark:text-blue-200">
        In the <strong>Medium of Exchange</strong> scenario, improvements in scaling solutions like the Lightning Network
        enable Bitcoin to be used for everyday transactions.
      </p>
      <p class="mt-2 text-blue-800 dark:text-blue-200">
        Key implications include:
      </p>
      <ul class="list-disc pl-5 mt-1 space-y-1 text-blue-800 dark:text-blue-200">
        <li>Widespread merchant adoption of Bitcoin payments</li>
        <li>Significant disruption to payment processors and credit card networks</li>
        <li>Potential for banking the unbanked in regions with limited financial infrastructure</li>
      </ul>
    {:else if selectedScenario === 'reserve-currency'}
      <p class="text-blue-800 dark:text-blue-200">
        In the <strong>World Reserve Currency</strong> scenario, Bitcoin challenges the US Dollar as the global reserve currency,
        representing the most transformative potential outcome.
      </p>
      <p class="mt-2 text-blue-800 dark:text-blue-200">
        Key implications include:
      </p>
      <ul class="list-disc pl-5 mt-1 space-y-1 text-blue-800 dark:text-blue-200">
        <li>Fundamental restructuring of the global monetary system</li>
        <li>Reduced ability for countries to finance deficits through currency debasement</li>
        <li>Potential for a more stable global economic system with reduced boom-bust cycles</li>
        <li>Significant geopolitical power shifts as monetary policy becomes denationalized</li>
      </ul>
    {/if}
  </div>
</div>
