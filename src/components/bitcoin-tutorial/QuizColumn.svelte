<script>
  import { onMount } from 'svelte';
  import { 
    getModuleProgress, 
    updateModuleProgress, 
    resetProgress,
    getCompletedModulesCount 
  } from '../../utils/bitcoin-tutorial/progress-state.js';
  
  export let moduleNumber = 1;
  export let questions = [];
  export let isActive = false;
  
  let quizActive = false;
  let quizStarted = false;
  let quizCompleted = false;
  let selectedAnswers = Array(questions.length).fill(null);
  let isSubmitted = false;
  let score = 0;
  let buttonEnabled = false;
  let reviewMode = false;
  
  // Module titles for next module navigation
  const moduleTitles = [
    "What is Money?",
    "Properties of Good Money",
    "How Good Money Gets Corrupted",
    "The Proof of Reserves Problem",
    "How Bitcoin Fixes Money",
    "Fiat Economic System",
    "Bitcoin Economic System",
    "USD vs. BTC - Past 10 Years",
    "Future Projections"
  ];
  
  // Load saved progress
  onMount(() => {
    const moduleProgress = getModuleProgress(moduleNumber);
    
    if (moduleProgress.progress === 'completed') {
      quizCompleted = true;
      score = moduleProgress.score;
      
      // If module is already completed, show review button instead
      reviewMode = true;
    }
    
    // Listen for scroll activation event
    document.addEventListener('activate-quiz', () => {
      console.log('QuizColumn received activate-quiz event');
      buttonEnabled = true;
    });
    
    // Listen for module progress update events
    document.addEventListener('update-module-progress', (event) => {
      if (event.detail.moduleNumber === moduleNumber && event.detail.completed) {
        quizCompleted = true;
        reviewMode = true;
      }
    });
    
    // Listen for progress reset events
    document.addEventListener('progress-reset', () => {
      // Reset component state
      quizCompleted = false;
      reviewMode = false;
      quizActive = false;
      quizStarted = false;
      selectedAnswers = Array(questions.length).fill(null);
      isSubmitted = false;
      score = 0;
      buttonEnabled = false;
    });
    
    // Automatically activate button for completed modules
    if (quizCompleted) {
      buttonEnabled = true;
    }
  });
  
  function startQuiz() {
    quizActive = true;
    quizStarted = true;
    
    if (reviewMode) {
      // In review mode, show correct answers immediately
      isSubmitted = true;
      // Set all answers to correct for display purposes
      selectedAnswers = questions.map(q => q.correctAnswer);
    } else {
      isSubmitted = false;
      selectedAnswers = Array(questions.length).fill(null);
    }
  }
  
  function selectAnswer(questionIndex, answerIndex) {
    if (!isSubmitted && !reviewMode) {
      selectedAnswers[questionIndex] = answerIndex;
    }
  }
  
  function submitQuiz() {
    isSubmitted = true;
    score = 0;
    
    // Calculate score
    for (let i = 0; i < questions.length; i++) {
      if (selectedAnswers[i] === questions[i].correctAnswer) {
        score++;
      }
    }
    
    // Update progress using centralized state management
    const completed = score === questions.length;
    updateModuleProgress(moduleNumber, score, questions.length);
    
    if (completed) {
      quizCompleted = true;
      reviewMode = true;
    }
    
    // Dispatch event to update module status
    const event = new CustomEvent('quiz-completed', {
      detail: {
        moduleNumber,
        score,
        completed
      }
    });
    document.dispatchEvent(event);
    
    // Check if all modules are completed
    checkAllModulesCompleted();
  }
  
  function resetQuiz() {
    if (reviewMode) {
      closeQuiz();
    } else {
      isSubmitted = false;
      selectedAnswers = Array(questions.length).fill(null);
    }
  }
  
  function closeQuiz() {
    quizActive = false;
  }
  
  function checkAllModulesCompleted() {
    const completedCount = getCompletedModulesCount();
    const totalModules = 9;
    
    // If all modules are completed, dispatch event to show the certificate link
    if (completedCount === totalModules) {
      const certEvent = new CustomEvent('course-completed', {
        detail: {
          completed: true,
          date: new Date().toISOString()
        }
      });
      document.dispatchEvent(certEvent);
    }
  }
  
  function handleRestartProgress() {
    if (confirm('Are you sure you want to restart your progress? This will erase all your quiz scores and completion status.')) {
      resetProgress();
    }
  }
  
  function navigateToNextModule() {
    if (moduleNumber < 9) {
      window.location.href = `/bitcoin-tutorial/module/${moduleNumber + 1}`;
    }
  }
  
  function navigateToCertificate() {
    window.location.href = '/bitcoin-tutorial/certificate';
  }
</script>

<div class="h-full flex flex-col bg-white dark:bg-gray-800">
  <div class="p-4 bg-blue-600 dark:bg-blue-700 text-white flex justify-between items-center">
    <h2 class="text-xl font-bold">Module {moduleNumber} Quiz</h2>
  </div>
  
  <div class="flex-1 overflow-y-auto p-4">
    {#if !quizActive}
      <div class="flex flex-col items-center justify-center h-full">
        <button 
          class="bg-blue-600 dark:bg-blue-700 text-white py-3 px-6 rounded-lg text-lg font-semibold mb-4 w-full max-w-xs {!buttonEnabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700 dark:hover:bg-blue-600'} transition-colors" 
          disabled={!buttonEnabled}
          on:click={startQuiz}
        >
          {reviewMode ? 'Review Quiz' : 'Take Quiz'}
        </button>
        
        {#if !buttonEnabled && !reviewMode}
          <p class="text-center text-gray-600 dark:text-gray-400">
            Please read through the module content first
          </p>
        {:else if quizCompleted}
          <p class="text-center text-green-600 dark:text-green-400 font-semibold mt-4 mb-4">
            Module completed with score: {score}/{questions.length}
          </p>
          
          <!-- Next Module or Certificate Link -->
          {#if moduleNumber < 9}
            <button 
              on:click={navigateToNextModule}
              class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center cursor-pointer transition-colors"
            >
              Next Module: {moduleTitles[moduleNumber]} 
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
          {:else}
            <button 
              on:click={navigateToCertificate}
              class="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300 font-medium flex items-center cursor-pointer transition-colors"
            >
              View Your Bitcoin Certificate 
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
            </button>
          {/if}
        {/if}
      </div>
    {:else}
      {#if !isSubmitted}
        <div class="space-y-8">
          {#each questions as question, qIndex}
            <div class="quiz-question">
              <p class="font-medium mb-4 text-gray-900 dark:text-gray-100">{qIndex + 1}. {question.text}</p>
              <div class="space-y-2">
                {#each question.answers as answer, aIndex}
                  <button 
                    class="w-full text-left p-2 rounded border transition-colors {selectedAnswers[qIndex] === aIndex ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-gray-900 dark:text-gray-100' : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}"
                    on:click={() => selectAnswer(qIndex, aIndex)}
                  >
                    {answer}
                  </button>
                {/each}
              </div>
            </div>
          {/each}
          
          <button 
            class="w-full bg-blue-600 dark:bg-blue-700 text-white py-3 rounded-lg text-lg font-semibold mt-8 transition-colors {selectedAnswers.includes(null) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700 dark:hover:bg-blue-600'}"
            disabled={selectedAnswers.includes(null)}
            on:click={submitQuiz}
          >
            Submit Answers
          </button>
        </div>
      {:else}
        <div class="space-y-8">
          {#each questions as question, qIndex}
            <div class="quiz-question">
              <p class="font-medium mb-4 text-gray-900 dark:text-gray-100">{qIndex + 1}. {question.text}</p>
              <div class="space-y-2">
                {#each question.answers as answer, aIndex}
                  <div 
                    class="w-full text-left p-4 rounded border 
                      {aIndex === question.correctAnswer ? 'border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/20 text-gray-900 dark:text-gray-100' : 
                        (!reviewMode && selectedAnswers[qIndex] === aIndex ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/20 text-gray-900 dark:text-gray-100' : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300')}"
                  >
                    {answer}
                    {#if aIndex === question.correctAnswer}
                      <span class="ml-2 text-green-600 dark:text-green-400 font-semibold">✓ Correct Answer</span>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/each}
          
          <div class="text-center py-6">
            {#if reviewMode}
              <p class="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Module Completed</p>
            {:else}
              <p class="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">Your Score: {score}/{questions.length}</p>
              {#if score === questions.length}
                <p class="text-green-600 dark:text-green-400 text-xl mb-6">Perfect! Module completed.</p>
                
                <!-- Next Module or Certificate Link -->
                {#if moduleNumber < 9}
                  <button 
                    on:click={navigateToNextModule}
                    class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center justify-center mb-6 cursor-pointer transition-colors"
                  >
                    Next Module: {moduleTitles[moduleNumber]} 
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                  </button>
                {:else}
                                      <button 
                      on:click={navigateToCertificate}
                      class="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300 font-medium flex items-center justify-center mb-6 cursor-pointer transition-colors"
                    >
                      View Your Bitcoin Certificate 
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                      </svg>
                    </button>
                {/if}
              {:else}
                <p class="text-gray-600 dark:text-gray-400 mb-6">Keep studying and try again!</p>
              {/if}
            {/if}
            
            <div class="flex space-x-4">
              <button 
                class="flex-1 bg-blue-600 dark:bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                on:click={resetQuiz}
              >
                {reviewMode ? 'Close' : 'Try Again'}
              </button>
              
              {#if !reviewMode}
                <button 
                  class="flex-1 bg-gray-600 dark:bg-gray-700 text-white py-3 rounded-lg font-semibold hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                  on:click={closeQuiz}
                >
                  Close
                </button>
              {/if}
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </div>
  
  <!-- Restart Progress Button (Fixed at bottom right) -->
  <div class="p-2 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
    <button 
      class="w-full text-xs bg-red-500 dark:bg-red-600 text-white py-2 px-3 rounded hover:bg-red-600 dark:hover:bg-red-500 transition-colors"
      on:click={handleRestartProgress}
      title="Restart all progress and clear all quiz scores"
    >
      🔄 Restart Progress
    </button>
  </div>
</div>
