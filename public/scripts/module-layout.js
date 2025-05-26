import { getModuleProgress } from '/utils/progress-state.js';

export function initializeModuleLayout(moduleNumber) {
  document.addEventListener('DOMContentLoaded', () => {
    const contentColumn = document.getElementById('content-column');
    const endMarker = document.getElementById('content-end-marker');
    const progressDisplay = document.getElementById('module-progress');
    const currentModuleNumber = moduleNumber;
    
    // Quiz activation state
    let quizActive = false;
    
    // Check for existing progress
    const moduleProgress = getModuleProgress(currentModuleNumber);
    
    if (progressDisplay) {
      if (moduleProgress.progress === 'completed') {
        progressDisplay.textContent = 'Completed';
        progressDisplay.classList.add('text-green-600');
        
        // Automatically activate quiz if module was previously completed
        activateQuiz();
      } else if (moduleProgress.progress === 'in-progress') {
        progressDisplay.textContent = 'In Progress';
        progressDisplay.classList.add('text-yellow-600');
      }
    }
    
    // Listen for scroll events to detect when user reaches bottom
    if (contentColumn) {
      contentColumn.addEventListener('scroll', checkScrollPosition);
    }
    
    // Check if user has scrolled to the bottom
    function checkScrollPosition() {
      if (!quizActive && endMarker && contentColumn) {
        // Check if user has scrolled close to the bottom
        const scrollTop = contentColumn.scrollTop;
        const scrollHeight = contentColumn.scrollHeight;
        const clientHeight = contentColumn.clientHeight;
        
        // Activate when user is within 100px of the bottom
        if (scrollTop + clientHeight >= scrollHeight - 100) {
          console.log('Quiz activation triggered - scroll position reached');
          activateQuiz();
        }
      }
    }
    
    // Activate the quiz
    function activateQuiz() {
      quizActive = true;
      console.log('Activating quiz - dispatching activate-quiz event');
      
      // Dispatch event to activate quiz
      const activateEvent = new CustomEvent('activate-quiz');
      document.dispatchEvent(activateEvent);
    }
    
    // Listen for quiz completion events
    document.addEventListener('quiz-completed', (event) => {
      if (progressDisplay) {
        if (event.detail.completed) {
          progressDisplay.textContent = 'Completed';
          progressDisplay.classList.remove('text-yellow-600');
          progressDisplay.classList.add('text-green-600');
          
          // Update module completion in the sidebar
          updateSidebarProgress(currentModuleNumber, true);
        } else {
          progressDisplay.textContent = 'In Progress';
          progressDisplay.classList.remove('text-green-600');
          progressDisplay.classList.add('text-yellow-600');
        }
      }
    });
    
    // Update sidebar progress for a specific module
    function updateSidebarProgress(moduleNum, completed) {
      if (completed) {
        // Dispatch an event to update the sidebar
        const updateEvent = new CustomEvent('update-module-progress', {
          detail: {
            moduleNumber: moduleNum,
            completed: true
          }
        });
        document.dispatchEvent(updateEvent);
      }
    }
    
    // Initial check in case content is already scrolled to bottom
    setTimeout(() => {
      console.log('Initial scroll check');
      if (contentColumn) {
        console.log('Content column dimensions:', {
          scrollTop: contentColumn.scrollTop,
          scrollHeight: contentColumn.scrollHeight,
          clientHeight: contentColumn.clientHeight
        });
      }
      checkScrollPosition();
    }, 500);
    
    // Initial check for module completion to update sidebar
    if (moduleProgress.progress === 'completed') {
      updateSidebarProgress(currentModuleNumber, true);
    }
  });
} 