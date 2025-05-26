<script>
  import { onMount } from 'svelte';
  
  // Bitcoin properties
  const properties = [
    { 
      id: 'scarcity', 
      name: 'Digital Scarcity', 
      description: 'Bitcoin has a fixed supply cap of 21 million coins, making it the first truly scarce digital asset.',
      details: 'Bitcoin\'s supply is controlled by code, not people. New bitcoins are created through mining at a predetermined and ever-decreasing rate. The last bitcoin will be mined around the year 2140.',
      icon: '📊'
    },
    { 
      id: 'decentralization', 
      name: 'Decentralization', 
      description: 'Bitcoin operates through a distributed network with no single point of failure or control.',
      details: 'The Bitcoin network consists of thousands of nodes worldwide, each maintaining a copy of the blockchain. This makes it resistant to censorship, shutdown attempts, and single points of failure.',
      icon: '🌐'
    },
    { 
      id: 'security', 
      name: 'Cryptographic Security', 
      description: 'Bitcoin uses advanced cryptography to secure transactions and control the creation of new coins.',
      details: 'Bitcoin uses SHA-256 for its proof-of-work algorithm and ECDSA for digital signatures. These cryptographic standards ensure that transactions cannot be forged and the network remains secure.',
      icon: '🔒'
    },
    { 
      id: 'verification', 
      name: 'Trustless Verification', 
      description: 'Anyone can verify all transactions and the total supply without trusting any third party.',
      details: 'Bitcoin\'s blockchain is a public ledger that anyone can download and verify. This solves the "proof of reserves" problem that has plagued traditional monetary systems.',
      icon: '✓'
    },
    { 
      id: 'portability', 
      name: 'Global Portability', 
      description: 'Bitcoin can be sent anywhere in the world, at any time, without permission from any authority.',
      details: 'Bitcoin transactions are not limited by banking hours, national borders, or government controls. A transaction from New York to Tokyo works exactly the same as one between neighbors.',
      icon: '🌍'
    },
    { 
      id: 'divisibility', 
      name: 'Infinite Divisibility', 
      description: 'Each bitcoin can be divided into 100 million units (satoshis), enabling microtransactions.',
      details: 'The smallest unit of bitcoin, the satoshi (0.00000001 BTC), allows for extremely small payments that would be impractical with traditional payment systems.',
      icon: '➗'
    },
    { 
      id: 'programmability', 
      name: 'Programmable Money', 
      description: 'Bitcoin enables conditional transfers and time-locked transactions through its scripting language.',
      details: 'Bitcoin\'s scripting language allows for various conditions to be attached to transactions, such as requiring multiple signatures or only allowing funds to be spent after a certain time.',
      icon: '💻'
    }
  ];
  
  // Comparison with traditional money
  const comparisons = [
    { 
      property: 'Supply Control', 
      bitcoin: 'Mathematical algorithm, capped at 21 million', 
      fiat: 'Central banks, unlimited potential supply',
      gold: 'Natural scarcity, ~1-2% annual increase'
    },
    { 
      property: 'Issuance', 
      bitcoin: 'Decentralized mining through proof-of-work', 
      fiat: 'Centralized issuance by governments',
      gold: 'Mining companies, central banks'
    },
    { 
      property: 'Verification', 
      bitcoin: 'Public blockchain, verifiable by anyone', 
      fiat: 'Trusted third parties, limited transparency',
      gold: 'Physical assays, trusted custodians'
    },
    { 
      property: 'Portability', 
      bitcoin: 'Digital, instant global transfer', 
      fiat: 'Digital within banking system, physical cash limited',
      gold: 'Physical, difficult to transport'
    },
    { 
      property: 'Divisibility', 
      bitcoin: 'Down to 0.00000001 BTC (1 satoshi)', 
      fiat: 'Down to 0.01 (1 cent)',
      gold: 'Difficult to divide without specialized equipment'
    },
    { 
      property: 'Seizure Resistance', 
      bitcoin: 'High with proper key management', 
      fiat: 'Low, subject to freezing and confiscation',
      gold: 'Medium, physical security required'
    }
  ];
  
  let selectedProperty = properties[0];
  let showComparison = false;
  
  function selectProperty(property) {
    selectedProperty = property;
    showComparison = false;
  }
  
  function toggleComparison() {
    showComparison = !showComparison;
  }
  
  onMount(() => {
    // Any initialization code here
  });
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/20 p-6 border border-gray-200 dark:border-gray-700">
  <h2 class="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-gray-100">Bitcoin Properties Explorer</h2>
  
  <div class="mb-8">
    <p class="text-gray-700 dark:text-gray-300 mb-4">
      Bitcoin combines the best properties of previous forms of money while eliminating many of their weaknesses.
      Explore Bitcoin's key innovations below.
    </p>
    
    <div class="flex justify-end">
      <button 
        on:click={toggleComparison}
        class="px-4 py-2 bg-purple-600 dark:bg-purple-700 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors text-sm"
      >
        {showComparison ? 'Show Properties' : 'Compare with Traditional Money'}
      </button>
    </div>
  </div>

  {#if !showComparison}
    <!-- Properties Explorer -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {#each properties as property}
        <button 
          class={`p-4 rounded-lg border-2 transition-colors ${selectedProperty.id === property.id ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'}`}
          on:click={() => selectProperty(property)}
        >
          <div class="text-2xl mb-2">{property.icon}</div>
          <div class="font-semibold text-gray-900 dark:text-gray-100">{property.name}</div>
        </button>
      {/each}
    </div>
    
    <!-- Selected Property Details -->
    <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-6 border border-gray-200 dark:border-gray-600">
      <h3 class="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">{selectedProperty.name}</h3>
      <p class="text-lg mb-4 text-gray-700 dark:text-gray-300">{selectedProperty.description}</p>
      <div class="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
        <h4 class="font-semibold mb-2 text-gray-900 dark:text-gray-100">How it works:</h4>
        <p class="text-gray-700 dark:text-gray-300">{selectedProperty.details}</p>
      </div>
    </div>
  {:else}
    <!-- Comparison Table -->
    <div class="overflow-x-auto">
      <table class="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <thead>
          <tr class="bg-gray-100 dark:bg-gray-700">
            <th class="px-4 py-2 text-left text-gray-900 dark:text-gray-100">Property</th>
            <th class="px-4 py-2 text-center text-gray-900 dark:text-gray-100">Bitcoin</th>
            <th class="px-4 py-2 text-center text-gray-900 dark:text-gray-100">Fiat Currency</th>
            <th class="px-4 py-2 text-center text-gray-900 dark:text-gray-100">Gold</th>
          </tr>
        </thead>
        <tbody>
          {#each comparisons as comparison}
            <tr class="border-t border-gray-200 dark:border-gray-600">
              <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{comparison.property}</td>
              <td class="px-4 py-3 bg-green-50 dark:bg-green-900/20 text-gray-900 dark:text-gray-100">{comparison.bitcoin}</td>
              <td class="px-4 py-3 bg-red-50 dark:bg-red-900/20 text-gray-900 dark:text-gray-100">{comparison.fiat}</td>
              <td class="px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 text-gray-900 dark:text-gray-100">{comparison.gold}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
  
  <div class="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
    <h3 class="font-bold text-lg mb-2 text-blue-900 dark:text-blue-100">Key Insight</h3>
    <p class="text-blue-800 dark:text-blue-200">
      Bitcoin wasn't created in a vacuum - it was specifically designed to address the shortcomings of previous monetary systems.
      By combining digital technology with sound money principles, Bitcoin creates a new kind of money that is both scarce like gold
      and digitally native for the internet age.
    </p>
  </div>
</div>
