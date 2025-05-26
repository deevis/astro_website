<script>
  import { onMount } from 'svelte';
  
  // Simulation parameters
  let interestRate = 2; // Initial interest rate (%)
  let moneySupply = 100; // Initial money supply (trillion $)
  let inflation = 2; // Initial inflation rate (%)
  let assetBubble = 0; // Initial asset bubble level (0-100)
  let wealthGap = 30; // Initial wealth gap (0-100)
  let economicGrowth = 3; // Initial economic growth (%)
  
  // Crisis parameters
  let crisisActive = false;
  let crisisType = '';
  let crisisSeverity = 0;
  let crisisYear = 0;
  let currentYear = 2023;
  
  // Game state
  let gameRunning = false;
  let gameSpeed = 1; // Years per step
  let gameInterval;
  let gameHistory = [];
  let gameMessage = 'Welcome to the Central Bank Simulator. Adjust the interest rate to manage the economy.';
  
  // Crises that can occur
  const possibleCrises = [
    { type: 'Recession', probability: 0.15, description: 'Economic growth has stalled and unemployment is rising.' },
    { type: 'Asset Bubble', probability: 0.1, description: 'Asset prices have become detached from fundamental values.' },
    { type: 'Inflation Spike', probability: 0.1, description: 'Prices are rising rapidly across the economy.' },
    { type: 'Banking Crisis', probability: 0.05, description: 'Several major banks are facing liquidity problems.' },
    { type: 'Sovereign Debt Crisis', probability: 0.05, description: 'Government debt levels have become unsustainable.' }
  ];
  
  // Start the simulation
  function startSimulation() {
    if (!gameRunning) {
      gameRunning = true;
      gameInterval = setInterval(advanceSimulation, 1000 / gameSpeed);
    }
  }
  
  // Pause the simulation
  function pauseSimulation() {
    gameRunning = false;
    clearInterval(gameInterval);
  }
  
  // Reset the simulation
  function resetSimulation() {
    pauseSimulation();
    interestRate = 2;
    moneySupply = 100;
    inflation = 2;
    assetBubble = 0;
    wealthGap = 30;
    economicGrowth = 3;
    crisisActive = false;
    crisisType = '';
    crisisSeverity = 0;
    crisisYear = 0;
    currentYear = 2023;
    gameHistory = [];
    gameMessage = 'Simulation reset. Adjust the interest rate to manage the economy.';
  }
  
  // Advance the simulation by one step
  function advanceSimulation() {
    currentYear += 1;
    
    // Record current state
    gameHistory.push({
      year: currentYear,
      interestRate,
      moneySupply,
      inflation,
      assetBubble,
      wealthGap,
      economicGrowth
    });
    
    // Limit history length
    if (gameHistory.length > 20) {
      gameHistory.shift();
    }
    
    // Check for crisis resolution
    if (crisisActive) {
      if (handleCrisis()) {
        crisisActive = false;
        crisisType = '';
        crisisSeverity = 0;
        gameMessage = `The ${crisisType} has been successfully managed!`;
      }
    }
    
    // Check for new crisis
    if (!crisisActive && Math.random() < 0.1) {
      generateCrisis();
    }
    
    // Update economic indicators based on interest rate and other factors
    updateEconomy();
  }
  
  // Generate a new economic crisis
  function generateCrisis() {
    // Select a crisis based on probabilities
    const rand = Math.random();
    let cumulativeProbability = 0;
    let selectedCrisis;
    
    for (const crisis of possibleCrises) {
      cumulativeProbability += crisis.probability;
      if (rand < cumulativeProbability) {
        selectedCrisis = crisis;
        break;
      }
    }
    
    if (!selectedCrisis) return;
    
    crisisActive = true;
    crisisType = selectedCrisis.type;
    crisisSeverity = 50 + Math.floor(Math.random() * 50); // 50-100
    crisisYear = currentYear;
    
    // Adjust economic indicators based on crisis type
    switch (crisisType) {
      case 'Recession':
        economicGrowth -= 4 + (crisisSeverity / 20);
        break;
      case 'Asset Bubble':
        assetBubble += 30 + (crisisSeverity / 5);
        break;
      case 'Inflation Spike':
        inflation += 5 + (crisisSeverity / 10);
        break;
      case 'Banking Crisis':
        economicGrowth -= 3;
        moneySupply -= 10;
        break;
      case 'Sovereign Debt Crisis':
        economicGrowth -= 2;
        interestRate += 2;
        break;
    }
    
    gameMessage = `${crisisType} Crisis! ${selectedCrisis.description} Severity: ${crisisSeverity}%`;
  }
  
  // Handle ongoing crisis
  function handleCrisis() {
    const yearsSinceCrisis = currentYear - crisisYear;
    
    // Crisis gets worse if not addressed properly
    if (yearsSinceCrisis > 3 && crisisSeverity > 20) {
      gameMessage = `The ${crisisType} crisis is worsening due to inadequate policy response!`;
      crisisSeverity += 10;
      return false;
    }
    
    // Check if policy response is appropriate
    let policyEffectiveness = 0;
    
    switch (crisisType) {
      case 'Recession':
        // Lower rates help with recession
        policyEffectiveness = 5 - interestRate;
        break;
      case 'Asset Bubble':
        // Higher rates help with asset bubbles
        policyEffectiveness = interestRate - 2;
        break;
      case 'Inflation Spike':
        // Higher rates help with inflation
        policyEffectiveness = interestRate - 3;
        break;
      case 'Banking Crisis':
        // Lower rates and increased money supply help with banking crises
        policyEffectiveness = (5 - interestRate) + ((moneySupply - 100) / 20);
        break;
      case 'Sovereign Debt Crisis':
        // Balanced approach needed
        policyEffectiveness = 5 - Math.abs(interestRate - 3);
        break;
    }
    
    // Reduce crisis severity based on policy effectiveness
    crisisSeverity -= policyEffectiveness * 2;
    
    // Crisis resolved if severity drops below threshold
    return crisisSeverity <= 0;
  }
  
  // Update economic indicators based on policy decisions
  function updateEconomy() {
    // Interest rate effects
    if (interestRate < 1) {
      // Very low rates
      moneySupply += 5 + (1 - interestRate) * 5;
      assetBubble += 5;
      economicGrowth += 0.5;
      wealthGap += 2;
    } else if (interestRate < 3) {
      // Moderate rates
      moneySupply += 2;
      assetBubble += Math.max(0, 3 - interestRate);
      economicGrowth += 0.2;
      wealthGap += 1;
    } else if (interestRate < 5) {
      // Normal rates
      moneySupply += 1;
      assetBubble -= 1;
      wealthGap += 0.5;
    } else if (interestRate < 8) {
      // High rates
      moneySupply -= 1;
      assetBubble -= 3;
      economicGrowth -= 0.5;
      wealthGap -= 0.5;
    } else {
      // Very high rates
      moneySupply -= 3;
      assetBubble -= 5;
      economicGrowth -= 1.5;
      wealthGap -= 1;
    }
    
    // Money supply effects on inflation
    inflation = 2 + ((moneySupply - 100) / 20);
    
    // Asset bubble effects
    if (assetBubble > 70) {
      economicGrowth += 0.5; // Short-term boost
      wealthGap += 1;
      
      // Risk of bubble burst
      if (assetBubble > 90 && Math.random() < 0.3) {
        gameMessage = "The asset bubble has burst! Economic growth is plummeting.";
        assetBubble = 20;
        economicGrowth -= 3;
      }
    }
    
    // Inflation effects
    if (inflation > 5) {
      economicGrowth -= (inflation - 5) / 2;
      wealthGap += (inflation - 5) / 4;
    }
    
    // Apply random variations
    economicGrowth += (Math.random() - 0.5) * 0.5;
    inflation += (Math.random() - 0.5) * 0.3;
    
    // Ensure values stay within reasonable bounds
    moneySupply = Math.max(50, Math.min(300, moneySupply));
    inflation = Math.max(0, Math.min(20, inflation));
    assetBubble = Math.max(0, Math.min(100, assetBubble));
    wealthGap = Math.max(10, Math.min(90, wealthGap));
    economicGrowth = Math.max(-5, Math.min(7, economicGrowth));
  }
  
  // Print money (quantitative easing)
  function printMoney() {
    moneySupply += 10;
    gameMessage = "Quantitative easing implemented. Money supply increased by 10%.";
  }
  
  // Implement price controls
  function implementPriceControls() {
    inflation -= 2;
    economicGrowth -= 1;
    gameMessage = "Price controls implemented. Inflation reduced but economic growth has slowed.";
  }
  
  onMount(() => {
    // Any initialization code here
    return () => {
      if (gameInterval) clearInterval(gameInterval);
    };
  });
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/20 p-6 border border-gray-200 dark:border-gray-700">
  <h2 class="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-gray-100">Central Bank Simulator</h2>
  
  <div class="mb-8">
    <p class="text-gray-700 dark:text-gray-300 mb-4">
      Take on the role of a central banker and manage the economy through various challenges.
      Adjust interest rates, implement monetary policies, and respond to economic crises.
    </p>
  </div>

  <!-- Game Controls -->
  <div class="flex space-x-4 mb-6">
    {#if gameRunning}
      <button 
        class="px-4 py-2 bg-yellow-500 dark:bg-yellow-600 text-white rounded hover:bg-yellow-600 dark:hover:bg-yellow-700 transition-colors"
        on:click={pauseSimulation}
      >
        Pause
      </button>
    {:else}
      <button 
        class="px-4 py-2 bg-green-500 dark:bg-green-600 text-white rounded hover:bg-green-600 dark:hover:bg-green-700 transition-colors"
        on:click={startSimulation}
      >
        Start
      </button>
    {/if}
    
    <button 
      class="px-4 py-2 bg-red-500 dark:bg-red-600 text-white rounded hover:bg-red-600 dark:hover:bg-red-700 transition-colors"
      on:click={resetSimulation}
    >
      Reset
    </button>
    
    <div class="flex items-center">
      <span class="mr-2 text-sm text-gray-700 dark:text-gray-300">Speed:</span>
      <input 
        type="range" 
        min="1" 
        max="5" 
        bind:value={gameSpeed} 
        class="w-24 accent-blue-500 dark:accent-blue-400"
      />
      <span class="ml-1 text-sm text-gray-700 dark:text-gray-300">{gameSpeed}x</span>
    </div>
  </div>

  <!-- Game Message -->
  {#if gameMessage}
    <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-6 text-sm border border-blue-200 dark:border-blue-800">
      <p class="text-blue-800 dark:text-blue-200">{gameMessage}</p>
    </div>
  {/if}

  <!-- Crisis Alert -->
  {#if crisisActive}
    <div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-6">
      <div class="flex justify-between items-center">
        <h3 class="font-bold text-red-700 dark:text-red-300">{crisisType} Crisis</h3>
        <div class="text-sm text-red-600 dark:text-red-400">Year {crisisYear}</div>
      </div>
      <div class="mt-2">
        <div class="text-sm mb-1 text-red-700 dark:text-red-300">Severity:</div>
        <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
          <div class="bg-red-600 dark:bg-red-500 h-2.5 rounded-full" style={`width: ${crisisSeverity}%`}></div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Main Dashboard -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
    <!-- Left Column: Controls -->
    <div>
      <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4 border border-gray-200 dark:border-gray-600">
        <h3 class="font-semibold mb-3 text-gray-900 dark:text-gray-100">Monetary Policy Controls</h3>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Interest Rate: {interestRate.toFixed(1)}%
          </label>
          <input 
            type="range" 
            min="0" 
            max="10" 
            step="0.25"
            bind:value={interestRate} 
            class="w-full accent-blue-500 dark:accent-blue-400"
          />
          <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Expansionary</span>
            <span>Neutral</span>
            <span>Contractionary</span>
          </div>
        </div>
        
        <div class="flex space-x-2">
          <button 
            class="flex-1 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm"
            on:click={printMoney}
          >
            Print Money (QE)
          </button>
          
          <button 
            class="flex-1 py-2 bg-purple-600 dark:bg-purple-700 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors text-sm"
            on:click={implementPriceControls}
          >
            Price Controls
          </button>
        </div>
      </div>
      
      <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
        <h3 class="font-semibold mb-3 text-gray-900 dark:text-gray-100">Economic Indicators</h3>
        
        <div class="space-y-3">
          <div>
            <div class="flex justify-between mb-1">
              <span class="text-sm text-gray-700 dark:text-gray-300">Economic Growth</span>
              <span class={`text-sm font-medium ${economicGrowth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {economicGrowth.toFixed(1)}%
              </span>
            </div>
            <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
              <div class={`h-2 rounded-full ${economicGrowth >= 0 ? 'bg-green-500 dark:bg-green-400' : 'bg-red-500 dark:bg-red-400'}`} 
                   style={`width: ${Math.min(100, Math.abs(economicGrowth) * 10)}%`}></div>
            </div>
          </div>
          
          <div>
            <div class="flex justify-between mb-1">
              <span class="text-sm text-gray-700 dark:text-gray-300">Inflation Rate</span>
              <span class={`text-sm font-medium ${inflation <= 3 ? 'text-green-600 dark:text-green-400' : inflation <= 6 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                {inflation.toFixed(1)}%
              </span>
            </div>
            <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
              <div class={`h-2 rounded-full ${inflation <= 3 ? 'bg-green-500 dark:bg-green-400' : inflation <= 6 ? 'bg-yellow-500 dark:bg-yellow-400' : 'bg-red-500 dark:bg-red-400'}`} 
                   style={`width: ${Math.min(100, inflation * 5)}%`}></div>
            </div>
          </div>
          
          <div>
            <div class="flex justify-between mb-1">
              <span class="text-sm text-gray-700 dark:text-gray-300">Money Supply</span>
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                ${moneySupply.toFixed(0)} trillion
              </span>
            </div>
            <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
              <div class="bg-blue-500 dark:bg-blue-400 h-2 rounded-full" 
                   style={`width: ${Math.min(100, moneySupply / 3)}%`}></div>
            </div>
          </div>
          
          <div>
            <div class="flex justify-between mb-1">
              <span class="text-sm text-gray-700 dark:text-gray-300">Asset Bubble Risk</span>
              <span class={`text-sm font-medium ${assetBubble <= 30 ? 'text-green-600 dark:text-green-400' : assetBubble <= 70 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                {assetBubble.toFixed(0)}%
              </span>
            </div>
            <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
              <div class={`h-2 rounded-full ${assetBubble <= 30 ? 'bg-green-500 dark:bg-green-400' : assetBubble <= 70 ? 'bg-yellow-500 dark:bg-yellow-400' : 'bg-red-500 dark:bg-red-400'}`} 
                   style={`width: ${assetBubble}%`}></div>
            </div>
          </div>
          
          <div>
            <div class="flex justify-between mb-1">
              <span class="text-sm text-gray-700 dark:text-gray-300">Wealth Gap</span>
              <span class={`text-sm font-medium ${wealthGap <= 30 ? 'text-green-600 dark:text-green-400' : wealthGap <= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                {wealthGap.toFixed(0)}%
              </span>
            </div>
            <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
              <div class={`h-2 rounded-full ${wealthGap <= 30 ? 'bg-green-500 dark:bg-green-400' : wealthGap <= 60 ? 'bg-yellow-500 dark:bg-yellow-400' : 'bg-red-500 dark:bg-red-400'}`} 
                   style={`width: ${wealthGap}%`}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Right Column: History and Effects -->
    <div>
      <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4 border border-gray-200 dark:border-gray-600">
        <div class="flex justify-between items-center mb-3">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100">Economic History</h3>
          <div class="text-sm text-gray-600 dark:text-gray-400">Year: {currentYear}</div>
        </div>
        
        {#if gameHistory.length > 0}
          <div class="h-40 overflow-y-auto">
            <table class="min-w-full text-xs">
              <thead class="bg-gray-100 dark:bg-gray-600">
                <tr>
                  <th class="px-2 py-1 text-left text-gray-900 dark:text-gray-100">Year</th>
                  <th class="px-2 py-1 text-right text-gray-900 dark:text-gray-100">Rate</th>
                  <th class="px-2 py-1 text-right text-gray-900 dark:text-gray-100">Growth</th>
                  <th class="px-2 py-1 text-right text-gray-900 dark:text-gray-100">Inflation</th>
                </tr>
              </thead>
              <tbody>
                {#each [...gameHistory].reverse() as record}
                  <tr class="border-t border-gray-200 dark:border-gray-600">
                    <td class="px-2 py-1 text-gray-900 dark:text-gray-100">{record.year}</td>
                    <td class="px-2 py-1 text-right text-gray-900 dark:text-gray-100">{record.interestRate.toFixed(1)}%</td>
                    <td class="px-2 py-1 text-right" class:text-red-600={record.economicGrowth < 0} class:dark:text-red-400={record.economicGrowth < 0} class:text-green-600={record.economicGrowth >= 0} class:dark:text-green-400={record.economicGrowth >= 0}>
                      {record.economicGrowth.toFixed(1)}%
                    </td>
                    <td class="px-2 py-1 text-right" class:text-red-600={record.inflation > 6} class:dark:text-red-400={record.inflation > 6} class:text-yellow-600={record.inflation > 3 && record.inflation <= 6} class:dark:text-yellow-400={record.inflation > 3 && record.inflation <= 6} class:text-green-600={record.inflation <= 3} class:dark:text-green-400={record.inflation <= 3}>
                      {record.inflation.toFixed(1)}%
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <div class="text-center text-gray-500 dark:text-gray-400 py-4">
            Start the simulation to see economic history
          </div>
        {/if}
      </div>
      
      <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
        <h3 class="font-semibold mb-3 text-gray-900 dark:text-gray-100">Policy Effects</h3>
        
        <div class="space-y-3 text-sm">
          <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
            <strong class="text-blue-900 dark:text-blue-100">Low Interest Rates (0-2%):</strong>
            <ul class="list-disc pl-5 mt-1 text-blue-800 dark:text-blue-200">
              <li>Stimulates economic growth</li>
              <li>Increases money supply</li>
              <li>Risk of asset bubbles</li>
              <li>Widens wealth gap</li>
            </ul>
          </div>
          
          <div class="p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
            <strong class="text-green-900 dark:text-green-100">Moderate Interest Rates (2-5%):</strong>
            <ul class="list-disc pl-5 mt-1 text-green-800 dark:text-green-200">
              <li>Balanced economic growth</li>
              <li>Controlled inflation</li>
              <li>Stable asset prices</li>
            </ul>
          </div>
          
          <div class="p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
            <strong class="text-red-900 dark:text-red-100">High Interest Rates (5%+):</strong>
            <ul class="list-disc pl-5 mt-1 text-red-800 dark:text-red-200">
              <li>Slows economic growth</li>
              <li>Reduces inflation</li>
              <li>Deflates asset bubbles</li>
              <li>Can trigger recession if too high</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <div class="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
    <h3 class="font-bold text-lg mb-2 text-yellow-900 dark:text-yellow-100">Key Insight</h3>
    <p class="text-yellow-800 dark:text-yellow-200">
      Central banking creates inherent trade-offs between short-term economic growth and long-term stability.
      Lowering interest rates and printing money can stimulate growth in the short term, but often leads to
      asset bubbles, inflation, and increased wealth inequality over time.
    </p>
    <p class="mt-2 text-yellow-800 dark:text-yellow-200">
      This simulation demonstrates the challenges of managing a fiat monetary system, where central authorities
      must constantly intervene to address the problems created by previous interventions.
    </p>
  </div>
</div>
