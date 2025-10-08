/**
 * Utility functions for the Language Showdown page
 */

import { readdir } from 'fs/promises';
import { join } from 'path';

/**
 * Get all available languages by scanning the config directory
 */
export async function getAvailableLanguages() {
  try {
    const configDir = join(process.cwd(), 'src/config/language-showdown');
    const files = await readdir(configDir);
    
    const languageFiles = files.filter(file => 
      file.endsWith('.json') && 
      !file.startsWith('sections') && 
      !file.startsWith('comparisons')
    );
    
    const languages = [];
    
    for (const file of languageFiles) {
      const langName = file.replace('.json', '');
      const langData = await import(`../config/language-showdown/${file}`);
      languages.push({
        id: langName,
        name: langData.name,
        color: langData.color,
        icon: langData.icon
      });
    }
    
    return languages;
  } catch (error) {
    console.error('Error loading languages:', error);
    return [];
  }
}

/**
 * Load a specific language's configuration
 */
export async function loadLanguage(languageId) {
  try {
    const langData = await import(`../config/language-showdown/${languageId}.json`);
    return langData;
  } catch (error) {
    console.error(`Error loading language ${languageId}:`, error);
    return null;
  }
}

/**
 * Load sections configuration
 */
export async function loadSections() {
  try {
    const sections = await import('../config/language-showdown/sections.json');
    return sections.sections;
  } catch (error) {
    console.error('Error loading sections:', error);
    return [];
  }
}

/**
 * Load comparison data for two languages
 */
export async function loadComparison(lang1, lang2) {
  try {
    // Try to load comparison file in both orders
    const comparisonFile = `comparisons-${lang1}-${lang2}.json`;
    const reverseFile = `comparisons-${lang2}-${lang1}.json`;
    
    try {
      const comparison = await import(`../config/language-showdown/${comparisonFile}`);
      return comparison.comparisons;
    } catch {
      // Try reverse order
      const comparison = await import(`../config/language-showdown/${reverseFile}`);
      return comparison.comparisons;
    }
  } catch (error) {
    console.error(`Error loading comparison for ${lang1} vs ${lang2}:`, error);
    return null;
  }
}

/**
 * Get a snippet for a specific language and section
 */
export function getSnippet(language, sectionId) {
  return language?.snippets?.[sectionId] || '// No snippet available';
}

/**
 * Get comparison info for a specific section
 */
export function getComparisonInfo(comparisons, sectionId) {
  return comparisons?.[sectionId] || {
    why: 'Comparison information not available.',
    keyPoints: []
  };
}

