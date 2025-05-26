<script>
  import { onMount } from 'svelte';
  
  // Timeline data
  const timelineData = [
    {
      era: 'Barter System',
      year: '10,000 BCE - 3000 BCE',
      description: 'Direct exchange of goods and services without using money',
      challenges: 'Required double coincidence of wants, difficult to transport and store value',
      advantages: 'Simple, direct, no need for currency',
      tradeEfficiency: 10
    },
    {
      era: 'Commodity Money',
      year: '3000 BCE - 1000 BCE',
      description: 'Use of valuable items like cattle, shells, and salt as medium of exchange',
      challenges: 'Perishable, difficult to transport, inconsistent value',
      advantages: 'Intrinsic value, widely recognized',
      tradeEfficiency: 30
    },
    {
      era: 'Precious Metals',
      year: '1000 BCE - 600 BCE',
      description: 'Gold, silver, and bronze used as medium of exchange',
      challenges: 'Heavy, difficult to verify purity, security risks',
      advantages: 'Durable, divisible, consistent value',
      tradeEfficiency: 50
    },
    {
      era: 'First Coins',
      year: '600 BCE - 1600 CE',
      description: 'Standardized metal pieces with government stamps indicating value',
      challenges: 'Clipping, counterfeiting, debasement by rulers',
      advantages: 'Portable, standardized, widely accepted',
      tradeEfficiency: 70
    },
    {
      era: 'Paper Money',
      year: '1600 CE - 1971',
      description: 'Paper notes backed by precious metals (gold standard)',
      challenges: 'Required trust in issuer, vulnerable to over-issuance',
      advantages: 'Lightweight, easier to transport, divisible',
      tradeEfficiency: 85
    },
    {
      era: 'Fiat Currency',
      year: '1971 - 2009',
      description: 'Government-issued money not backed by physical commodity',
      challenges: 'Vulnerable to inflation, requires trust in government',
      advantages: 'Flexible supply, easily transported, widely accepted',
      tradeEfficiency: 90
    },
    {
      era: 'Digital Bitcoin',
      year: '2009 - Present',
      description: 'Decentralized digital currency with fixed supply',
      challenges: 'Price volatility, technical complexity, regulatory uncertainty',
      advantages: 'Borderless, censorship-resistant, mathematically scarce',
      tradeEfficiency: 95
    }
  ];
  
  let selectedEra = timelineData[0];
  let animationActive = false;
  let animationTimeout;
  
  function selectEra(era) {
    selectedEra = era;
    clearTimeout(animationTimeout);
    animationActive = true;
    animationTimeout = setTimeout(() => {
      animationActive = false;
    }, 500);
  }
  
  function simulateBarter() {
    alert('Barter simulation: You have fish but need pottery. The potter doesn\'t want fish right now - trade failed! This illustrates the "double coincidence of wants" problem that money solves.');
  }
  
  onMount(() => {
    // Any initialization code here
  });
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/20 p-6 border border-gray-200 dark:border-gray-700">
  <h2 class="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-gray-100">Money Evolution Timeline</h2>
  
  <div class="mb-8">
    <p class="text-gray-700 dark:text-gray-300 mb-4">
      Explore how money evolved through different forms, each solving specific problems
      of the previous system while introducing new capabilities.
    </p>
  </div>

  <!-- Timeline Navigation -->
  <div class="relative mb-8">
    <div class="h-1 bg-gray-200 dark:bg-gray-700 rounded-full">
      <div class="absolute top-0 left-0 h-1 bg-blue-500 dark:bg-blue-400 rounded-full" style={`width: ${selectedEra.tradeEfficiency}%`}></div>
    </div>
    
    <div class="flex justify-between mt-2">
      {#each timelineData as era, i}
        <button 
          class={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-colors ${selectedEra === era ? 'bg-blue-500 dark:bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300'}`}
          on:click={() => selectEra(era)}
        >
          {i + 1}
        </button>
      {/each}
    </div>
    
    <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
      <span>10,000 BCE</span>
      <span>Present</span>
    </div>
  </div>

  <!-- Selected Era Details -->
  <div class={`bg-gray-50 dark:bg-gray-700 rounded-lg p-6 transition-all duration-500 border border-gray-200 dark:border-gray-600 ${animationActive ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'}`}>
    <div class="flex justify-between items-start mb-4">
      <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">{selectedEra.era}</h3>
      <span class="text-sm text-gray-500 dark:text-gray-400">{selectedEra.year}</span>
    </div>
    
    <p class="mb-4 text-gray-700 dark:text-gray-300">{selectedEra.description}</p>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div>
        <h4 class="font-semibold text-red-600 dark:text-red-400 mb-2">Challenges:</h4>
        <p class="text-sm text-gray-600 dark:text-gray-400">{selectedEra.challenges}</p>
      </div>
      <div>
        <h4 class="font-semibold text-green-600 dark:text-green-400 mb-2">Advantages:</h4>
        <p class="text-sm text-gray-600 dark:text-gray-400">{selectedEra.advantages}</p>
      </div>
    </div>
    
    <div class="mt-6">
      <div class="flex items-center mb-2">
        <span class="text-sm font-medium mr-2 text-gray-700 dark:text-gray-300">Trade Efficiency:</span>
        <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
          <div class="bg-blue-600 dark:bg-blue-500 h-2.5 rounded-full" style={`width: ${selectedEra.tradeEfficiency}%`}></div>
        </div>
        <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">{selectedEra.tradeEfficiency}%</span>
      </div>
      
      {#if selectedEra.era === 'Barter System'}
        <button 
          class="mt-4 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm"
          on:click={simulateBarter}
        >
          Simulate Barter Trade
        </button>
      {/if}
    </div>
  </div>
  
  <div class="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
    <h3 class="font-bold text-lg mb-2 text-blue-900 dark:text-blue-100">Key Insight</h3>
    <p class="text-blue-800 dark:text-blue-200">
      Money has evolved to solve specific problems in trade and value storage. Each form improved upon the last,
      with Bitcoin representing the latest innovation combining the scarcity of gold with the convenience of digital technology.
    </p>
  </div>
</div>
