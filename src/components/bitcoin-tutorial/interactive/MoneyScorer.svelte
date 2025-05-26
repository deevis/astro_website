<script>
  import { onMount } from 'svelte';
  
  // Money properties to evaluate
  const moneyTypes = [
    { id: 'shells', name: 'Shells', image: '/assets/shells.png' },
    { id: 'gold', name: 'Gold', image: '/assets/gold.png' },
    { id: 'fiat', name: 'Fiat Currency', image: '/assets/fiat.png' },
    { id: 'bitcoin', name: 'Bitcoin', image: '/assets/bitcoin.png' }
  ];
  
  // Properties to evaluate
  const properties = [
    { id: 'durability', name: 'Durability', description: 'Ability to withstand physical deterioration and remain usable over time' },
    { id: 'portability', name: 'Portability', description: 'Ease of transporting and transferring between parties' },
    { id: 'divisibility', name: 'Divisibility', description: 'Ability to be divided into smaller units for various transaction sizes' },
    { id: 'recognizability', name: 'Recognizability', description: 'Ease of identification and resistance to counterfeiting' },
    { id: 'scarcity', name: 'Scarcity', description: 'Limited supply that maintains value over time' },
    { id: 'fungibility', name: 'Fungibility', description: 'Each unit is interchangeable with any other unit of the same value' }
  ];
  
  // Default scores for each money type on each property
  const defaultScores = {
    shells: {
      durability: 30,
      portability: 60,
      divisibility: 10,
      recognizability: 70,
      scarcity: 40,
      fungibility: 50
    },
    gold: {
      durability: 90,
      portability: 30,
      divisibility: 40,
      recognizability: 80,
      scarcity: 80,
      fungibility: 90
    },
    fiat: {
      durability: 40,
      portability: 70,
      divisibility: 80,
      recognizability: 60,
      scarcity: 20,
      fungibility: 100
    },
    bitcoin: {
      durability: 100,
      portability: 100,
      divisibility: 100,
      recognizability: 70,
      scarcity: 100,
      fungibility: 90
    }
  };
  
  // User-adjusted scores
  let scores = JSON.parse(JSON.stringify(defaultScores));
  
  // Selected money type for detailed view
  let selectedMoney = moneyTypes[3]; // Default to Bitcoin
  
  // Calculate total score for a money type
  function calculateTotalScore(moneyType) {
    const moneyScores = scores[moneyType.id];
    return Object.values(moneyScores).reduce((sum, score) => sum + score, 0) / properties.length;
  }
  
  // Reset scores to default
  function resetScores() {
    scores = JSON.parse(JSON.stringify(defaultScores));
  }
  
  // Get ranking of money types based on total scores
  function getRanking() {
    return [...moneyTypes].sort((a, b) => calculateTotalScore(b) - calculateTotalScore(a));
  }
  
  $: ranking = getRanking();
  
  onMount(() => {
    // Any initialization code here
  });
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/20 p-6 border border-gray-200 dark:border-gray-700">
  <h2 class="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-gray-100">Money Properties Evaluation Dashboard</h2>
  
  <div class="mb-8">
    <p class="text-gray-700 dark:text-gray-300 mb-4">
      Adjust the sliders to score different forms of money based on their properties.
      See how each form of money compares and which one might be most effective overall.
    </p>
  </div>

  <!-- Money Type Selection -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
    {#each moneyTypes as moneyType}
      <button 
        class={`p-4 rounded-lg border-2 transition-colors ${selectedMoney.id === moneyType.id ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'}`}
        on:click={() => selectedMoney = moneyType}
      >
        <div class="flex flex-col items-center">
          <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full mb-2 flex items-center justify-center text-2xl">
            {moneyType.id === 'shells' ? '🐚' : 
             moneyType.id === 'gold' ? '🥇' : 
             moneyType.id === 'fiat' ? '💵' : '₿'}
          </div>
          <div class="font-semibold text-gray-900 dark:text-gray-100">{moneyType.name}</div>
          <div class="text-sm text-gray-500 dark:text-gray-400">Score: {calculateTotalScore(moneyType).toFixed(1)}</div>
        </div>
      </button>
    {/each}
  </div>
  
  <!-- Property Sliders for Selected Money -->
  <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-8 border border-gray-200 dark:border-gray-600">
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">{selectedMoney.name} Properties</h3>
      <button 
        class="px-3 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm"
        on:click={resetScores}
      >
        Reset All Scores
      </button>
    </div>
    
    <div class="space-y-6">
      {#each properties as property}
        <div>
          <div class="flex justify-between mb-1">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
              {property.name}
              <span class="text-xs text-gray-500 dark:text-gray-400 ml-1">({property.description})</span>
            </label>
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{scores[selectedMoney.id][property.id]}/100</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="100" 
            bind:value={scores[selectedMoney.id][property.id]} 
            class="w-full accent-blue-500 dark:accent-blue-400"
          />
        </div>
      {/each}
    </div>
  </div>
  
  <!-- Comparison Chart -->
  <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-6 mb-8">
    <h3 class="font-semibold mb-4 text-gray-900 dark:text-gray-100">Money Comparison</h3>
    
    <div class="space-y-6">
      {#each properties as property}
        <div>
          <div class="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">{property.name}</div>
          <div class="grid grid-cols-4 gap-2">
            {#each moneyTypes as moneyType}
              <div>
                <div class="text-xs text-center mb-1 text-gray-600 dark:text-gray-400">{moneyType.name}</div>
                <div class="h-4 bg-gray-200 dark:bg-gray-600 rounded-full">
                  <div 
                    class={`h-4 rounded-full ${
                      moneyType.id === 'shells' ? 'bg-yellow-500 dark:bg-yellow-400' : 
                      moneyType.id === 'gold' ? 'bg-yellow-600 dark:bg-yellow-500' : 
                      moneyType.id === 'fiat' ? 'bg-green-500 dark:bg-green-400' : 'bg-blue-500 dark:bg-blue-400'
                    }`}
                    style={`width: ${scores[moneyType.id][property.id]}%`}
                  ></div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>
  
  <!-- Rankings -->
  <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
    <h3 class="font-semibold mb-4 text-blue-900 dark:text-blue-100">Overall Rankings</h3>
    
    <div class="space-y-3">
      {#each ranking as moneyType, i}
        <div class="flex items-center bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
          <div class="font-bold text-xl mr-4 text-gray-900 dark:text-gray-100">{i + 1}</div>
          <div class="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-xl mr-3">
            {moneyType.id === 'shells' ? '🐚' : 
             moneyType.id === 'gold' ? '🥇' : 
             moneyType.id === 'fiat' ? '💵' : '₿'}
          </div>
          <div>
            <div class="font-medium text-gray-900 dark:text-gray-100">{moneyType.name}</div>
            <div class="text-sm text-gray-500 dark:text-gray-400">Average Score: {calculateTotalScore(moneyType).toFixed(1)}/100</div>
          </div>
          <div class="ml-auto w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
            <div 
              class={`h-2.5 rounded-full ${
                moneyType.id === 'shells' ? 'bg-yellow-500 dark:bg-yellow-400' : 
                moneyType.id === 'gold' ? 'bg-yellow-600 dark:bg-yellow-500' : 
                moneyType.id === 'fiat' ? 'bg-green-500 dark:bg-green-400' : 'bg-blue-500 dark:bg-blue-400'
              }`}
              style={`width: ${calculateTotalScore(moneyType)}%`}
            ></div>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
