<script>
  import { onMount } from 'svelte';
  
  // Simulation parameters
  let trustLevel = 50; // Initial trust level (0-100)
  let verificationLevel = 0; // Initial verification level (0-100)
  let goldReserves = 100; // Claimed gold reserves (tons)
  let actualGold = 70; // Actual gold reserves (tons)
  let rehypothecationFactor = 1.5; // How many times the same gold is claimed
  let auditSuccess = false; // Whether the audit was successful
  
  // Game state
  let gamePhase = 'intro'; // intro, audit, result
  let auditAttempts = 0;
  let auditMethods = [
    { id: 'visual', name: 'Visual Inspection', difficulty: 'Easy', effectiveness: 20, used: false },
    { id: 'weight', name: 'Weight Testing', difficulty: 'Medium', effectiveness: 40, used: false },
    { id: 'sampling', name: 'Random Sampling', difficulty: 'Medium', effectiveness: 60, used: false },
    { id: 'ultrasound', name: 'Ultrasound Testing', difficulty: 'Hard', effectiveness: 80, used: false },
    { id: 'fullaudit', name: 'Full Physical Audit', difficulty: 'Very Hard', effectiveness: 95, used: false }
  ];
  
  // Vault problems
  const vaultProblems = [
    { id: 'tungsten', name: 'Tungsten-filled bars', probability: 0.4, detected: false },
    { id: 'fractional', name: 'Fractional reserves', probability: 0.7, detected: false },
    { id: 'rehypothecation', name: 'Rehypothecated assets', probability: 0.6, detected: false },
    { id: 'paper', name: 'Paper gold certificates exceed physical', probability: 0.8, detected: false }
  ];
  
  let detectedProblems = [];
  let gameMessage = '';
  
  function startAudit() {
    gamePhase = 'audit';
    auditAttempts = 3;
    detectedProblems = [];
    verificationLevel = 0;
    gameMessage = 'You have 3 audit attempts to verify the gold reserves. Choose your methods wisely!';
  }
  
  function performAudit(methodId) {
    const method = auditMethods.find(m => m.id === methodId);
    if (!method || method.used || auditAttempts <= 0) return;
    
    // Mark method as used
    method.used = true;
    auditAttempts--;
    
    // Increase verification level based on method effectiveness
    verificationLevel += method.effectiveness;
    if (verificationLevel > 100) verificationLevel = 100;
    
    // Check for problems based on method effectiveness and problem probability
    vaultProblems.forEach(problem => {
      if (!problem.detected && Math.random() < (problem.probability * method.effectiveness / 100)) {
        problem.detected = true;
        detectedProblems.push(problem);
        
        // Adjust trust level based on problems found
        trustLevel -= 15;
        if (trustLevel < 0) trustLevel = 0;
      }
    });
    
    // Update game message
    if (detectedProblems.length > 0) {
      gameMessage = `Your ${method.name} revealed issues! Trust in the vault is decreasing.`;
    } else {
      gameMessage = `Your ${method.name} didn't reveal any issues, but are you sure everything is fine?`;
    }
    
    // Check if audit is complete
    if (auditAttempts === 0 || verificationLevel >= 95) {
      completeAudit();
    }
  }
  
  function completeAudit() {
    gamePhase = 'result';
    
    // Determine audit success
    auditSuccess = verificationLevel >= 80 && detectedProblems.length >= 2;
    
    if (auditSuccess) {
      gameMessage = 'Congratulations! Your thorough audit revealed significant discrepancies between claimed and actual reserves.';
      trustLevel = Math.max(trustLevel - 30, 0);
    } else if (verificationLevel >= 80) {
      gameMessage = 'Your verification was thorough, but you missed some important issues with the reserves.';
    } else if (detectedProblems.length >= 2) {
      gameMessage = 'You found some problems, but your verification wasn\'t thorough enough to be conclusive.';
    } else {
      gameMessage = 'Your audit was inconclusive. The vault continues to operate with questionable reserves.';
    }
  }
  
  function resetGame() {
    gamePhase = 'intro';
    trustLevel = 50;
    verificationLevel = 0;
    auditAttempts = 0;
    auditMethods.forEach(method => method.used = false);
    vaultProblems.forEach(problem => problem.detected = false);
    detectedProblems = [];
    gameMessage = '';
  }
  
  onMount(() => {
    // Any initialization code here
  });
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/20 p-6 border border-gray-200 dark:border-gray-700">
  <h2 class="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-gray-100">Trust vs. Verification Game</h2>
  
  {#if gamePhase === 'intro'}
    <div class="mb-8">
      <p class="text-gray-700 dark:text-gray-300 mb-4">
        You're tasked with auditing a major gold vault that claims to hold {goldReserves} tons of gold backing various financial products.
        Your goal is to verify if these claims are accurate or if there are discrepancies.
      </p>
      
      <div class="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg mb-6 border border-yellow-200 dark:border-yellow-800">
        <h3 class="font-semibold mb-2 text-yellow-900 dark:text-yellow-100">The Verification Challenge:</h3>
        <ul class="list-disc pl-5 space-y-1 text-yellow-800 dark:text-yellow-200">
          <li>Gold bars might be filled with tungsten</li>
          <li>The vault might be operating with fractional reserves</li>
          <li>The same gold might be pledged as collateral multiple times (rehypothecation)</li>
          <li>Paper gold certificates might exceed physical gold</li>
        </ul>
      </div>
      
      <button 
        class="w-full py-3 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
        on:click={startAudit}
      >
        Begin Audit
      </button>
    </div>
  {:else if gamePhase === 'audit'}
    <div class="mb-6">
      <div class="flex justify-between items-center mb-4">
        <div>
          <span class="text-sm text-gray-500 dark:text-gray-400">Trust Level:</span>
          <div class="w-40 bg-gray-200 dark:bg-gray-600 rounded-full h-2.5 mt-1">
            <div class="bg-blue-600 dark:bg-blue-500 h-2.5 rounded-full" style={`width: ${trustLevel}%`}></div>
          </div>
        </div>
        
        <div>
          <span class="text-sm text-gray-500 dark:text-gray-400">Verification Level:</span>
          <div class="w-40 bg-gray-200 dark:bg-gray-600 rounded-full h-2.5 mt-1">
            <div class="bg-green-600 dark:bg-green-500 h-2.5 rounded-full" style={`width: ${verificationLevel}%`}></div>
          </div>
        </div>
        
        <div>
          <span class="text-sm text-gray-500 dark:text-gray-400">Audit Attempts:</span>
          <div class="text-center font-bold text-gray-900 dark:text-gray-100">{auditAttempts}</div>
        </div>
      </div>
      
      {#if gameMessage}
        <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-4 text-sm border border-blue-200 dark:border-blue-800">
          <p class="text-blue-800 dark:text-blue-200">{gameMessage}</p>
        </div>
      {/if}
      
      <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-6 border border-gray-200 dark:border-gray-600">
        <h3 class="font-semibold mb-3 text-gray-900 dark:text-gray-100">Audit Methods:</h3>
        <div class="space-y-3">
          {#each auditMethods as method}
            <button 
              class={`w-full p-3 rounded-lg flex justify-between items-center ${method.used ? 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400' : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              on:click={() => performAudit(method.id)}
              disabled={method.used}
            >
              <div>
                <div class="font-medium text-gray-900 dark:text-gray-100">{method.name}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Difficulty: {method.difficulty}</div>
              </div>
              <div class="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                Effectiveness: {method.effectiveness}%
              </div>
            </button>
          {/each}
        </div>
      </div>
      
      {#if detectedProblems.length > 0}
        <div class="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg mb-4 border border-red-200 dark:border-red-800">
          <h3 class="font-semibold text-red-700 dark:text-red-300 mb-2">Issues Detected:</h3>
          <ul class="list-disc pl-5 space-y-1 text-red-800 dark:text-red-200">
            {#each detectedProblems as problem}
              <li>{problem.name}</li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  {:else if gamePhase === 'result'}
    <div class="mb-6">
      <div class={`p-6 rounded-lg mb-6 ${auditSuccess ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'}`}>
        <h3 class="text-xl font-bold mb-3 {auditSuccess ? 'text-green-900 dark:text-green-100' : 'text-yellow-900 dark:text-yellow-100'}">{auditSuccess ? 'Audit Successful!' : 'Audit Inconclusive'}</h3>
        <p class="mb-4 {auditSuccess ? 'text-green-800 dark:text-green-200' : 'text-yellow-800 dark:text-yellow-200'}">{gameMessage}</p>
        
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div class="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
            <div class="text-sm text-gray-500 dark:text-gray-400">Claimed Gold:</div>
            <div class="text-xl font-bold text-gray-900 dark:text-gray-100">{goldReserves} tons</div>
          </div>
          
          <div class="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
            <div class="text-sm text-gray-500 dark:text-gray-400">Actual Gold:</div>
            <div class="text-xl font-bold text-red-600 dark:text-red-400">{actualGold} tons</div>
          </div>
          
          <div class="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
            <div class="text-sm text-gray-500 dark:text-gray-400">Rehypothecation Factor:</div>
            <div class="text-xl font-bold text-gray-900 dark:text-gray-100">{rehypothecationFactor}x</div>
          </div>
          
          <div class="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
            <div class="text-sm text-gray-500 dark:text-gray-400">Paper Gold Ratio:</div>
            <div class="text-xl font-bold text-gray-900 dark:text-gray-100">{(goldReserves / actualGold).toFixed(1)}:1</div>
          </div>
        </div>
        
        <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 class="font-semibold mb-1 text-blue-900 dark:text-blue-100">The Verification Problem:</h4>
          <p class="text-sm text-blue-800 dark:text-blue-200">
            Traditional financial systems rely heavily on trust rather than verification. Even with audits,
            it's extremely difficult to verify that claimed reserves actually exist and aren't pledged multiple times.
          </p>
        </div>
      </div>
      
      <div class="flex space-x-4">
        <button 
          class="flex-1 py-3 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          on:click={resetGame}
        >
          Play Again
        </button>
        
        <button 
          class="flex-1 py-3 bg-green-600 dark:bg-green-700 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
          on:click={() => {
            alert("Bitcoin solves the verification problem through its public blockchain. Anyone can verify the entire supply and their own holdings without trusting any third party. This is why the Bitcoin community emphasizes 'Don't trust, verify.'");
          }}
        >
          See Bitcoin Solution
        </button>
      </div>
    </div>
  {/if}
  
  <div class="mt-8 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
    <h3 class="font-bold text-lg mb-2 text-gray-900 dark:text-gray-100">Key Insight</h3>
    <p class="text-gray-700 dark:text-gray-300">
      The "proof of reserves" problem has plagued monetary systems throughout history. Traditional systems require trusting
      third parties to honestly report their reserves, but this trust has been broken countless times.
    </p>
    <p class="mt-2 text-gray-700 dark:text-gray-300">
      Bitcoin's innovation is replacing "trust" with "verify" - allowing anyone to cryptographically verify the entire
      money supply and their own holdings without relying on any third party.
    </p>
  </div>
</div>
