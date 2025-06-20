/**
 * News utility functions for handling news feed data
 */

/**
 * Fetch the latest news feed data
 * @returns {Promise<Object>} News feed data
 */
export async function fetchLatestNewsFeed() {
  try {
    // Try to fetch the most recent news feed
    const response = await fetch('/news_feeds/2025/06/news_feed_2025-06-19_22-13-34.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.news_feed;
  } catch (error) {
    console.error('Error fetching news feed:', error);
    return null;
  }
}

/**
 * Get articles filtered by category
 * @param {Array} articles - Array of articles
 * @param {string} category - Category to filter by
 * @returns {Array} Filtered articles
 */
export function filterArticlesByCategory(articles, category) {
  if (!category || category === 'all') {
    return articles;
  }
  return articles.filter(article => article.category === category);
}

/**
 * Get articles filtered by importance
 * @param {Array} articles - Array of articles
 * @param {string} importance - Importance level to filter by
 * @returns {Array} Filtered articles
 */
export function filterArticlesByImportance(articles, importance) {
  if (!importance || importance === 'all') {
    return articles;
  }
  return articles.filter(article => article.importance === importance);
}

/**
 * Sort articles by date (newest first)
 * @param {Array} articles - Array of articles
 * @returns {Array} Sorted articles
 */
export function sortArticlesByDate(articles) {
  return [...articles].sort((a, b) => {
    const dateA = new Date(a.published_date);
    const dateB = new Date(b.published_date);
    return dateB - dateA;
  });
}

/**
 * Sort articles by importance (high > medium > low)
 * @param {Array} articles - Array of articles
 * @returns {Array} Sorted articles
 */
export function sortArticlesByImportance(articles) {
  const importanceOrder = { 'high': 3, 'medium': 2, 'low': 1 };
  return [...articles].sort((a, b) => {
    const importanceA = importanceOrder[a.importance] || 0;
    const importanceB = importanceOrder[b.importance] || 0;
    return importanceB - importanceA;
  });
}

/**
 * Format article date for display
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
export function formatArticleDate(dateString) {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Unknown';
  }
}

/**
 * Get unique categories from articles
 * @param {Array} articles - Array of articles
 * @returns {Array} Array of unique categories
 */
export function getUniqueCategories(articles) {
  const categories = articles.map(article => article.category);
  return [...new Set(categories)].sort();
}

/**
 * Get category display name and color
 * @param {string} category - Category name
 * @returns {Object} Category display info
 */
export function getCategoryInfo(category) {
  const categoryMap = {
    'bitcoin': { 
      name: 'Bitcoin', 
      color: 'bg-orange-500 text-white',
      icon: '₿'
    },
    'software_dev': { 
      name: 'Software Dev', 
      color: 'bg-blue-500 text-white',
      icon: '💻'
    },
    'ai_progress': { 
      name: 'AI Progress', 
      color: 'bg-purple-500 text-white',
      icon: '🤖'
    }
  };
  
  return categoryMap[category] || { 
    name: category, 
    color: 'bg-gray-500 text-white',
    icon: '📰'
  };
}

/**
 * Get importance display info
 * @param {string} importance - Importance level
 * @returns {Object} Importance display info
 */
export function getImportanceInfo(importance) {
  const importanceMap = {
    'high': { 
      name: 'High', 
      color: 'bg-red-500 text-white',
      icon: '🔥'
    },
    'medium': { 
      name: 'Medium', 
      color: 'bg-yellow-500 text-white',
      icon: '⚡'
    },
    'low': { 
      name: 'Low', 
      color: 'bg-green-500 text-white',
      icon: '📝'
    }
  };
  
  return importanceMap[importance] || { 
    name: importance, 
    color: 'bg-gray-500 text-white',
    icon: '📰'
  };
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Search articles by title and content
 * @param {Array} articles - Array of articles
 * @param {string} query - Search query
 * @returns {Array} Filtered articles
 */
export function searchArticles(articles, query) {
  if (!query || query.trim() === '') {
    return articles;
  }
  
  const searchTerm = query.toLowerCase().trim();
  return articles.filter(article => {
    return (
      article.title.toLowerCase().includes(searchTerm) ||
      article.content_preview.toLowerCase().includes(searchTerm) ||
      article.source.toLowerCase().includes(searchTerm) ||
      article.author.toLowerCase().includes(searchTerm) ||
      article.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );
  });
} 