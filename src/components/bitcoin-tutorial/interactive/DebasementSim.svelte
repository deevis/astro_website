<script>
  import { onMount } from 'svelte';
  
  // Simulation parameters
  let initialSilverContent = 90; // Initial silver content percentage
  let currentYear = 0; // Starting year
  let coinValue = 100; // Initial coin value (percentage)
  let inflationRate = 0; // Initial inflation rate
  let simulationSpeed = 1; // Years per step
  let isSimulationRunning = false;
  let simulationInterval;
  
  // Historical data
  const historicalEvents = [
    { year: 0, event: "Roman Republic issues pure silver denarius (90% silver content)", silverContent: 90 },
    { year: 64, event: "Emperor Nero reduces silver content to 85%", silverContent: 85 },
    { year: 100, event: "Further debasement under Emperor Trajan", silverContent: 75 },
    { year: 200, event: "Silver content falls to 50% under Septimius Severus", silverContent: 50 },
    { year: 270, event: "Crisis of the Third Century - silver content at 4%", silverContent: 4 },
    { year: 301, event: "Emperor Diocletian issues price controls to combat inflation", silverContent: 4 },
    { year: 307, event: "New silver coin (argenteus) introduced at 95% purity", silverContent: 95 },
    { year: 350, event: "Silver content reduced again to 5%", silverContent: 5 }
  ];
  
  let currentEvent = historicalEvents[0];
  
  // Modern era data (post-1971)
  const modernData = [
    { year: 1971, event: "Nixon ends gold standard, dollar becomes pure fiat", dollarValue: 100 },
    { year: 1975, event: "Inflation reaches 9% in the US", dollarValue: 80 },
    { year: 1980, event: "Inflation peaks at 14.8%, Fed raises interest rates", dollarValue: 55 },
    { year: 1990, event: "Dollar has lost nearly 50% of its 1971 purchasing power", dollarValue: 52 },
    { year: 2000, event: "Dot-com bubble, Fed increases money supply", dollarValue: 43 },
    { year: 2008, event: "Financial crisis, quantitative easing begins", dollarValue: 37 },
    { year: 2020, event: "COVID-19 pandemic, unprecedented money printing", dollarValue: 30 },
    { year: 2023, event: "Dollar has lost over 85% of its 1971 purchasing power", dollarValue: 15 }
  ];
  
  let showModernEra = false;
  let currentModernEvent = modernData[0];
  
  // Simulation functions
  function startSimulation() {
    if (!isSimulationRunning) {
      isSimulationRunning = true;
      simulationInterval = setInterval(advanceSimulation, 1000);
    }
  }
  
  function pauseSimulation() {
    isSimulationRunning = false;
    clearInterval(simulationInterval);
  }
  
  function resetSimulation() {
    pauseSimulation();
    currentYear = 0;
    coinValue = 100;
    inflationRate = 0;
    currentEvent = historicalEvents[0];
    initialSilverContent = 90;
  }
  
  function advanceSimulation() {
    currentYear += simulationSpeed;
    
    // Update silver content based on historical events
    let nextEvent = historicalEvents.find(event => event.year > currentYear);
    let prevEvent = [...historicalEvents].reverse().find(event => event.year <= currentYear);
    
    if (prevEvent) {
      currentEvent = prevEvent;
      initialSilverContent = prevEvent.silverContent;
    }
    
    // Calculate coin value based on silver content
    coinValue = initialSilverContent / 90 * 100;
    
    // Calculate inflation rate
    if (nextEvent && prevEvent) {
      const yearDiff = nextEvent.year - prevEvent.year;
      const valueDiff = prevEvent.silverContent - nextEvent.silverContent;
      if (yearDiff > 0) {
        inflationRate = (valueDiff / prevEvent.silverContent) * 100 / yearDiff;
      }
    }
    
    // End simulation at the end of the Roman era
    if (currentYear >= 350) {
      pauseSimulation();
    }
  }
  
  function toggleEra() {
    showModernEra = !showModernEra;
    pauseSimulation();
    
    if (showModernEra) {
      currentYear = 1971;
      coinValue = 100;
      currentModernEvent = modernData[0];
    } else {
      resetSimulation();
    }
  }
  
  function updateModernEvent() {
    let prevEvent = [...modernData].reverse().find(event => event.year <= currentYear);
    
    if (prevEvent) {
      currentModernEvent = prevEvent;
      coinValue = prevEvent.dollarValue;
    }
  }
  
  function advanceModernSimulation() {
    currentYear += simulationSpeed;
    updateModernEvent();
    
    // End simulation at the end of modern data
    if (currentYear >= 2023) {
      pauseSimulation();
    }
  }
  
  $: {
    if (isSimulationRunning && showModernEra) {
      clearInterval(simulationInterval);
      simulationInterval = setInterval(advanceModernSimulation, 1000);
    }
  }
  
  onMount(() => {
    // Any initialization code here
    return () => {
      if (simulationInterval) clearInterval(simulationInterval);
    };
  });
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/20 p-6 border border-gray-200 dark:border-gray-700">
  <h2 class="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-gray-100">Currency Debasement Simulator</h2>
  
  <div class="mb-8">
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {showModernEra ? 'Modern Era (1971-Present)' : 'Roman Denarius (0-350 CE)'}
      </h3>
      <button 
        class="px-4 py-2 bg-purple-600 dark:bg-purple-700 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors text-sm"
        on:click={toggleEra}
      >
        Switch to {showModernEra ? 'Roman Era' : 'Modern Era'}
      </button>
    </div>
    
    <p class="text-gray-700 dark:text-gray-300 mb-4">
      {showModernEra 
        ? 'Watch how the US Dollar has lost purchasing power since abandoning the gold standard in 1971.' 
        : 'See how Roman emperors debased their currency by reducing the silver content of coins.'}
    </p>
  </div>

  <!-- Simulation Controls -->
  <div class="flex space-x-4 mb-6">
    {#if isSimulationRunning}
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
        max="10" 
        bind:value={simulationSpeed} 
        class="w-24 accent-blue-500 dark:accent-blue-400"
      />
      <span class="ml-1 text-sm text-gray-700 dark:text-gray-300">{simulationSpeed}x</span>
    </div>
  </div>

  <!-- Simulation Display -->
  <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-6 border border-gray-200 dark:border-gray-600">
    <div class="flex justify-between items-center mb-4">
      <div>
        <span class="text-sm text-gray-500 dark:text-gray-400">Year:</span>
        <span class="text-xl font-bold ml-2 text-gray-900 dark:text-gray-100">
          {showModernEra ? currentYear : `${currentYear} CE`}
        </span>
      </div>
      
      <div>
        <span class="text-sm text-gray-500 dark:text-gray-400">
          {showModernEra ? 'Purchasing Power:' : 'Silver Content:'}
        </span>
        <span class="text-xl font-bold ml-2 text-gray-900 dark:text-gray-100">
          {coinValue.toFixed(1)}%
        </span>
      </div>
      
      {#if !showModernEra}
        <div>
          <span class="text-sm text-gray-500 dark:text-gray-400">Inflation Rate:</span>
          <span class="text-xl font-bold ml-2 {inflationRate > 5 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}">
            {inflationRate.toFixed(1)}%
          </span>
        </div>
      {/if}
    </div>
    
    <!-- Coin/Dollar Visualization -->
    <div class="flex justify-center mb-6">
      {#if showModernEra}
        <div class="relative w-40 h-40 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center overflow-hidden border border-green-200 dark:border-green-800">
          <div class="absolute inset-0 bg-green-500 dark:bg-green-400" style={`height: ${coinValue}%`}></div>
          <span class="relative text-2xl font-bold z-10 text-gray-900 dark:text-gray-100">$</span>
        </div>
      {:else}
        <div class="relative w-40 h-40 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center overflow-hidden border border-gray-400 dark:border-gray-500">
          <div class="absolute inset-0 bg-gray-100 dark:bg-gray-700" style={`height: ${100 - initialSilverContent}%`}></div>
          <div class="absolute inset-0 bg-gray-400 dark:bg-gray-300" style={`height: ${initialSilverContent}%`}></div>
          <span class="relative text-2xl font-bold z-10 text-gray-900 dark:text-gray-100">₪</span>
        </div>
      {/if}
    </div>
    
    <!-- Historical Event -->
    <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <h4 class="font-semibold mb-2 text-blue-900 dark:text-blue-100">Historical Event:</h4>
      <p class="text-blue-800 dark:text-blue-200">{showModernEra ? currentModernEvent.event : currentEvent.event}</p>
    </div>
  </div>
  
  <!-- Timeline -->
  <div class="relative h-8 bg-gray-200 dark:bg-gray-600 rounded-full mb-6">
    <div 
      class="absolute top-0 left-0 h-full bg-blue-500 dark:bg-blue-400 rounded-full"
      style={`width: ${showModernEra 
        ? ((currentYear - 1971) / (2023 - 1971) * 100) 
        : (currentYear / 350 * 100)}%`}
    ></div>
    
    {#if showModernEra}
      {#each modernData as data}
        <div 
          class="absolute top-0 h-full w-1 bg-red-500 dark:bg-red-400"
          style={`left: ${(data.year - 1971) / (2023 - 1971) * 100}%`}
        ></div>
      {/each}
    {:else}
      {#each historicalEvents as data}
        <div 
          class="absolute top-0 h-full w-1 bg-red-500 dark:bg-red-400"
          style={`left: ${data.year / 350 * 100}%`}
        ></div>
      {/each}
    {/if}
  </div>
  
  <div class="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
    <h3 class="font-bold text-lg mb-2 text-yellow-900 dark:text-yellow-100">Key Insight</h3>
    <p class="text-yellow-800 dark:text-yellow-200">
      {showModernEra 
        ? 'Since abandoning the gold standard in 1971, the US Dollar has lost over 85% of its purchasing power due to continuous expansion of the money supply.'
        : 'The Roman Empire\'s currency collapsed as emperors continuously debased their coins to fund wars and public works, leading to hyperinflation and economic instability.'}
    </p>
    <p class="mt-2 text-yellow-800 dark:text-yellow-200">
      {showModernEra 
        ? 'This pattern of fiat currency debasement has repeated throughout history whenever money is not anchored to a scarce asset.'
        : 'This pattern of debasement has repeated throughout history, from ancient civilizations to modern economies.'}
    </p>
  </div>
</div>
