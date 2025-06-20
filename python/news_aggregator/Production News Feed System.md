# Production News Feed System

## Quick Start

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the system:**
   ```bash
   python3 news_feed_system.py
   # or
   ./update_feed.sh
   ```

3. **Use the output:**
   ```javascript
   fetch('news_feed.json')
     .then(response => response.json())
     .then(data => {
       const articles = data.news_feed.articles;
       // Display articles in your website
     });
   ```

## Features

✅ **RSS Parsing** - 16 quality news sources  
✅ **Duplicate Detection** - Merges same stories from multiple sources  
✅ **Source Aggregation** - Shows all outlets reporting each story  
✅ **Smart Categorization** - Bitcoin, AI Progress, Software Development  
✅ **Rate Limiting** - 8-second delays between requests  
✅ **Error Handling** - Graceful failure with logging  

## Files

- `news_feed_system.py` - Main system (single file, 400+ lines)
- `requirements.txt` - 4 dependencies only
- `update_feed.sh` - Easy update script
- `news_feed.json` - Generated output
- `news_feed.log` - System logs

## Dependencies

Only 4 external packages required:
- **feedparser** - RSS parsing
- **beautifulsoup4** - HTML parsing  
- **requests** - HTTP requests
- **python-dateutil** - Date parsing

## Automation

```bash
# Crontab example - update every 2 hours
0 */2 * * * /path/to/update_feed.sh
```

## Output Format

```json
{
  "news_feed": {
    "articles": [
      {
        "title": "Bitcoin Reaches New High",
        "sources": [
          {"name": "CoinDesk", "url": "..."},
          {"name": "Cointelegraph", "url": "..."}
        ],
        "source_count": 2,
        "aggregated": true,
        "category": "bitcoin",
        "importance": "high"
      }
    ],
    "metadata": {
      "total_articles": 25,
      "aggregated_articles": 8,
      "multi_source_articles": 8
    }
  }
}
```

## System Requirements

- Python 3.11+
- 512MB RAM minimum
- Internet connection
- 50MB disk space

