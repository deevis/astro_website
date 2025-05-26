<script>
  import { onMount } from 'svelte';
  
  // Props
  export let moduleNumber;
  export let isOpen = false;
  export let questions = [];
  
  // State
  let selectedAnswers = {};
  let results = {};
  let submitted = false;
  let score = 0;
  
  // Initialize selected answers
  onMount(() => {
    // Reset answers when panel opens
    selectedAnswers = questions.reduce((acc, question, index) => {
      acc[index] = null;
      return acc;
    }, {});
    
    results = {};
    submitted = false;
    score = 0;
    
    // Check for saved progress
    const savedProgress = localStorage.getItem(`module-${moduleNumber}-progress`);
    const savedScore = localStorage.getItem(`module-${moduleNumber}-score`);
    
    if (savedProgress && savedScore) {
      // Could restore previous answers here if needed
    }
    
    // Listen for open quiz panel event
    const handleOpenQuiz = () => {
      isOpen = true;
      document.body.classList.add('quiz-panel-open');
    };
    
    document.addEventListener('open-quiz-panel', handleOpenQuiz);
    
    // Cleanup
    return () => {
      document.removeEventListener('open-quiz-panel', handleOpenQuiz);
    };
  });
  
  // Handle answer selection
  function selectAnswer(questionIndex, answerIndex) {
    if (submitted) return; // Prevent changing answers after submission
    
    selectedAnswers[questionIndex] = answerIndex;
  }
  
  // Submit quiz answers
  function submitAnswers() {
    submitted = true;
    
    // Check answers and calculate score
    let correctCount = 0;
    
    questions.forEach((question, index) => {
      const isCorrect = selectedAnswers[index] === question.correctAnswer;
      results[index] = isCorrect;
      
      if (isCorrect) {
        correctCount++;
      }
    });
    
    score = correctCount;
    
    // Update progress in localStorage
    const totalQuestions = questions.length;
    localStorage.setItem(`module-${moduleNumber}-progress`, correctCount === totalQuestions ? 'completed' : 'in-progress');
    localStorage.setItem(`module-${moduleNumber}-score`, `${correctCount}/${totalQuestions}`);
    
    // Dispatch event to update module progress display
    const progressEvent = new CustomEvent('quiz-completed', {
      detail: {
        score: correctCount,
        total: totalQuestions,
        completed: correctCount === totalQuestions
      }
    });
    document.dispatchEvent(progressEvent);
  }
  
  // Reset quiz
  function resetQuiz() {
    selectedAnswers = questions.reduce((acc, question, index) => {
      acc[index] = null;
      return acc;
    }, {});
    
    results = {};
    submitted = false;
    score = 0;
  }
  
  // Close panel
  function closePanel() {
    isOpen = false;
    document.body.classList.remove('quiz-panel-open');
  }
</script>

<div class={`fixed top-0 right-0 h-full w-96 bg-white shadow-lg transform transition-transform duration-300 ease-in-out z-50 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="p-4 border-b border-gray-200 flex justify-between items-center bg-blue-600 text-white">
      <h2 class="text-xl font-semibold">Module {moduleNumber} Quiz</h2>
      <button 
        class="p-2 rounded-full hover:bg-blue-700 transition-colors"
        on:click={closePanel}
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    
    <!-- Quiz Content (Scrollable) -->
    <div class="flex-1 overflow-y-auto p-4">
      {#if questions.length > 0}
        <div class="space-y-6">
          {#each questions as question, questionIndex}
            <div class="quiz-question bg-gray-50 p-4 rounded-lg">
              <p class="font-medium mb-3">{questionIndex + 1}. {question.text}</p>
              
              <div class="space-y-2">
                {#each question.answers as answer, answerIndex}
                  <div 
                    class={`p-3 rounded-lg border cursor-pointer transition-colors
                      ${selectedAnswers[questionIndex] === answerIndex ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}
                      ${submitted && selectedAnswers[questionIndex] === answerIndex && !results[questionIndex] ? 'border-red-500 bg-red-50' : ''}
                      ${submitted && question.correctAnswer === answerIndex ? 'border-green-500 bg-green-50' : ''}`}
                    on:click={() => selectAnswer(questionIndex, answerIndex)}
                  >
                    {answer}
                  </div>
                {/each}
              </div>
              
              {#if submitted && !results[questionIndex]}
                <p class="text-red-500 text-sm mt-2">
                  Incorrect. The correct answer is: {question.answers[question.correctAnswer]}
                </p>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-gray-500 text-center py-8">No quiz questions available for this module.</p>
      {/if}
    </div>
    
    <!-- Footer -->
    <div class="p-4 border-t border-gray-200">
      {#if submitted}
        <div class="mb-4">
          <div class="text-center font-bold text-xl">
            Your Score: {score}/{questions.length}
            {#if score === questions.length}
              <span class="text-green-500 block mt-1">Perfect! Module completed.</span>
            {:else}
              <span class="text-blue-500 block mt-1">Keep learning and try again!</span>
            {/if}
          </div>
        </div>
        <div class="flex space-x-4">
          <button 
            class="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            on:click={resetQuiz}
          >
            Try Again
          </button>
          <button 
            class="flex-1 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            on:click={closePanel}
          >
            Close
          </button>
        </div>
      {:else}
        <button 
          class="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          on:click={submitAnswers}
          disabled={Object.values(selectedAnswers).some(val => val === null)}
        >
          Submit Answers
        </button>
      {/if}
    </div>
  </div>
</div>

<!-- Overlay when panel is open -->
{#if isOpen}
  <div 
    class="fixed inset-0 bg-black bg-opacity-50 z-40"
    on:click={closePanel}
  ></div>
{/if}
