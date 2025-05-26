// Centralized state management for Bitcoin Education Series progress
const STORAGE_KEY = 'bitcoin-education-progress';

// Default state structure
const defaultState = {
  modules: {
    1: { progress: 'not-started', score: 0, totalQuestions: 3 },
    2: { progress: 'not-started', score: 0, totalQuestions: 3 },
    3: { progress: 'not-started', score: 0, totalQuestions: 3 },
    4: { progress: 'not-started', score: 0, totalQuestions: 3 },
    5: { progress: 'not-started', score: 0, totalQuestions: 3 },
    6: { progress: 'not-started', score: 0, totalQuestions: 3 },
    7: { progress: 'not-started', score: 0, totalQuestions: 3 },
    8: { progress: 'not-started', score: 0, totalQuestions: 3 },
    9: { progress: 'not-started', score: 0, totalQuestions: 3 }
  },
  course: {
    completed: false,
    completionDate: null
  },
  user: {
    certificateName: ''
  }
};

// Get the current state from localStorage
export function getProgressState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with default state to handle any missing properties
      return {
        ...defaultState,
        ...parsed,
        modules: { ...defaultState.modules, ...parsed.modules },
        course: { ...defaultState.course, ...parsed.course },
        user: { ...defaultState.user, ...parsed.user }
      };
    }
  } catch (error) {
    console.warn('Error parsing progress state from localStorage:', error);
  }
  return { ...defaultState };
}

// Save the state to localStorage
export function saveProgressState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Error saving progress state to localStorage:', error);
  }
}

// Get module progress
export function getModuleProgress(moduleNumber) {
  const state = getProgressState();
  return state.modules[moduleNumber] || defaultState.modules[moduleNumber];
}

// Update module progress
export function updateModuleProgress(moduleNumber, score, totalQuestions) {
  const state = getProgressState();
  const completed = score === totalQuestions;
  
  state.modules[moduleNumber] = {
    progress: completed ? 'completed' : 'in-progress',
    score: score,
    totalQuestions: totalQuestions
  };
  
  // Check if all modules are completed
  const allCompleted = Object.values(state.modules).every(module => module.progress === 'completed');
  if (allCompleted && !state.course.completed) {
    state.course.completed = true;
    state.course.completionDate = new Date().toISOString();
  }
  
  saveProgressState(state);
  return state;
}

// Get course completion status
export function getCourseCompletion() {
  const state = getProgressState();
  return state.course;
}

// Get user certificate name
export function getCertificateName() {
  const state = getProgressState();
  return state.user.certificateName;
}

// Update user certificate name
export function updateCertificateName(name) {
  const state = getProgressState();
  state.user.certificateName = name;
  saveProgressState(state);
}

// Reset all progress
export function resetProgress() {
  localStorage.removeItem(STORAGE_KEY);
  
  // Dispatch event to notify components of reset
  const resetEvent = new CustomEvent('progress-reset');
  document.dispatchEvent(resetEvent);
}

// Get completed modules count
export function getCompletedModulesCount() {
  const state = getProgressState();
  return Object.values(state.modules).filter(module => module.progress === 'completed').length;
}

// Legacy compatibility functions (for gradual migration)
export function getLegacyModuleProgress(moduleNumber) {
  const module = getModuleProgress(moduleNumber);
  return module.progress === 'completed' ? 'completed' : 
         module.progress === 'in-progress' ? 'in-progress' : null;
}

export function getLegacyModuleScore(moduleNumber) {
  const module = getModuleProgress(moduleNumber);
  return module.progress !== 'not-started' ? `${module.score}/${module.totalQuestions}` : null;
} 