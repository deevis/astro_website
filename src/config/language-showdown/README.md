# Language Showdown Configuration

This directory contains the configuration files for the Language Showdown page, which provides interactive side-by-side comparisons of programming languages.

## Directory Structure

```
language-showdown/
├── README.md                          # This file
├── sections.json                      # Defines all comparison sections and categories
├── {language}.json                    # Language-specific code snippets (e.g., java.json, ruby.json)
└── comparisons-{lang1}-{lang2}.json   # Comparison explanations for language pairs
```

## Adding a New Language

To add support for a new language, follow these steps:

### 1. Create a Language Configuration File

Create a new JSON file named `{language-id}.json` with the following structure:

```json
{
  "name": "Python",
  "color": "#3776ab",
  "icon": "python",
  "snippets": {
    "hello-world": "print(\"Hello, World!\")",
    "variables": "# Python code here...",
    "strings": "# Python code here...",
    ...
  }
}
```

**Fields:**
- `name`: Display name of the language
- `color`: Hex color code for the language's header (brand color)
- `icon`: Icon identifier (currently for display purposes)
- `snippets`: Object mapping section IDs to code snippets

**Important:** The `snippets` object must include keys for all section IDs defined in `sections.json`.

### 2. Create Comparison Files (Optional)

If you want to provide detailed comparisons between your new language and existing ones, create comparison files:

`comparisons-{lang1}-{lang2}.json`

Example: `comparisons-python-ruby.json`

```json
{
  "leftLanguage": "python",
  "rightLanguage": "ruby",
  "comparisons": {
    "hello-world": {
      "why": "Both Python and Ruby emphasize simplicity...",
      "keyPoints": [
        "Both use print/puts for output",
        "Neither requires semicolons",
        "Both are interpreted languages"
      ]
    },
    ...
  }
}
```

**Fields:**
- `leftLanguage`: ID of the left language
- `rightLanguage`: ID of the right language
- `comparisons`: Object mapping section IDs to comparison information
  - `why`: Explanation of the key differences
  - `keyPoints`: Array of bullet points highlighting important aspects

### 3. Update the Astro Page

Currently, languages are manually imported in `src/pages/language-showdown.astro`. Add your new language:

```javascript
// Add import
import pythonConfig from '../config/language-showdown/python.json';

// Add to availableLanguages array
const availableLanguages = [
  { id: 'java', name: javaConfig.name, color: javaConfig.color, icon: javaConfig.icon },
  { id: 'ruby', name: rubyConfig.name, color: rubyConfig.color, icon: rubyConfig.icon },
  { id: 'python', name: pythonConfig.name, color: pythonConfig.color, icon: pythonConfig.icon }
];

// Add to allLanguages object
const allLanguages = {
  java: javaConfig,
  ruby: rubyConfig,
  python: pythonConfig
};
```

### 4. Test Your Changes

1. Start the development server: `npm run dev`
2. Navigate to `/language-showdown`
3. Select your new language from the dropdown
4. Verify all sections display correctly

## Section IDs Reference

All language configuration files must include snippets for these section IDs:

### Basics
- `hello-world`
- `variables`
- `duck-typing`
- `strings`
- `conditionals`
- `case-statements`

### Collections
- `arrays`
- `hashes`
- `iteration`
- `filtering`

### Object-Oriented
- `classes`
- `getters-setters`
- `inheritance`
- `modules`

### Data & I/O
- `file-io`
- `json`

### Concurrency
- `threading`

### Meta & Advanced
- `metaprogramming`

## Future Enhancements

### Automatic Language Discovery
The utility file `src/utils/language-showdown.js` includes functions for scanning the directory and automatically discovering languages. To enable:

1. Update `language-showdown.astro` to use `getAvailableLanguages()`
2. Dynamically import language configs based on user selection
3. This will eliminate the need to manually update the Astro page

### Default Comparison Fallback
When a comparison file doesn't exist for a language pair, the page currently shows a generic message. Consider creating a template comparison or using AI to generate basic comparisons.

### Multi-Language Comparison
Extend the UI to support comparing 3+ languages side-by-side for advanced users.

## Tips for Writing Good Comparisons

1. **Be Concise**: Keep code snippets focused on the specific concept
2. **Be Idiomatic**: Show the way native developers write code, not translations
3. **Explain Trade-offs**: Discuss pros/cons, not just differences
4. **Use Real Examples**: Practical code > theoretical concepts
5. **Consider the Audience**: Assume readers know the "left" language and are learning the "right"

## Questions or Issues?

If you encounter issues or have questions about the configuration format, please refer to the existing language files (java.json, ruby.json) as examples.

