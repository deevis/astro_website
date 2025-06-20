# News Feed Aggregator System

A production-ready RSS news aggregation system with intelligent duplicate detection and organized timestamped output files.

## Features

- **Organized Directory Structure**: Files saved in `public/news_feeds/year/month/` format
- **Timestamped Files**: Creates files with format `news_feed_YYYY-MM-DD_HH-MM-SS.json`
- **6-Hour Update Intervals**: Only updates every 6 hours to prevent excessive API calls
- **Duplicate Detection**: Advanced similarity matching to aggregate duplicate stories
- **Source Summaries**: Displays article counts by source and category
- **Fail-Fast Logic**: Skips update if not enough time has passed
- **Web-Ready Structure**: Files organized for easy web application consumption

## Directory Structure

```
../../public/news_feeds/
├── index.json                                    # API discovery index
├── 2025/
│   ├── 06/
│   │   ├── news_feed_2025-06-19_22-13-34.json  # Timestamped data files
│   │   └── news_feed_2025-06-20_04-15-22.json
│   └── 07/
│       └── news_feed_2025-07-01_10-30-45.json
└── 2026/
    └── 01/
        └── news_feed_2026-01-15_14-20-10.json
```

*Note: Files are stored in the main project's `public/news_feeds/` directory for web application access.*

## Usage

### Basic Usage
```bash
python news_feed_system.py
```

### Using Shell Script
```bash
./update_feed.sh
```

## Output

The system generates:

1. **Organized JSON files** in `public/news_feeds/YYYY/MM/news_feed_YYYY-MM-DD_HH-MM-SS.json`
2. **Console summary** showing:
   - Total articles
   - Articles by category
   - Top 10 sources
   - Update status
   - Full file path

## Configuration

- **Update Interval**: Set in `ProductionNewsFeed(update_interval_hours=6)`
- **Directory Structure**: `../../public/news_feeds/year/month/` (relative to script location)
- **Sources**: Configured in the `self.feeds` dictionary
- **Rate Limiting**: 8-second delay between RSS feed requests

## Example Output

```
✅ News feed generated successfully!
📊 Total articles: 70
📁 Output: ../../public/news_feeds\2025\06\news_feed_2025-06-19_22-13-34.json

📊 News Feed Summary
📁 File: ../../public/news_feeds\2025\06\news_feed_2025-06-19_22-13-34.json
🕒 Generated: 2025-06-19T22:13:34.524294+00:00
📰 Total articles: 70

📂 Articles by category:
   bitcoin: 25
   software_dev: 25
   ai_progress: 20

🌐 Articles by source:
   Cointelegraph.com News: 5
   Slashdot: Developers: 5
   DEV Community: 5
   ... and 7 more sources
```

## Categories

- **bitcoin**: Cryptocurrency and Bitcoin news
- **software_dev**: Software development, programming languages, tools
- **ai_progress**: Artificial intelligence developments and research

## File Management

- Files are automatically organized by year and month in the main project's `public` folder
- Old files are preserved for historical purposes
- The system automatically finds the most recent file across all subdirectories
- Legacy files in the script directory are supported for backwards compatibility
- Directory structure is created automatically as needed

## Web Application Integration

The main project's `public/news_feeds/` directory structure is designed for easy integration with web applications:

- Files are organized in a logical year/month hierarchy
- JSON format is web-friendly
- Predictable file naming convention
- Easy to serve via HTTP/HTTPS (already in public directory)
- Can be accessed directly at `/news_feeds/YYYY/MM/filename.json`
- API endpoints available through the index.json file 