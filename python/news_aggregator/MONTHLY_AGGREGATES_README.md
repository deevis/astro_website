# Monthly Aggregate News Feed System

## Overview

The Monthly Aggregate system replaces individual timestamped feed snapshots with a single, continuously-updated file per month. This dramatically reduces storage while enabling powerful time-travel and story lifecycle tracking.

## Key Concepts

### Single Living Document
- **One file per month**: `aggregate_2025_10.json`
- **Continuously updated**: Every RSS fetch updates the current month's aggregate
- **Story lifecycle tracking**: Each story has `first_seen` and `last_seen` timestamps
- **No raw feeds**: Eliminates need for hundreds of snapshot files

### Story Deduplication
- Stories are tracked across time and sources
- Same story appearing in 20 feeds = 1 entry with lifecycle data
- 95% reduction in storage (40MB → 1.8MB for 4 months)

## Data Structure

```json
{
  "monthly_aggregate": {
    "version": "2.0",
    "month": "2025-10",
    "is_current": true,
    "last_updated": "2025-10-12T14:30:00Z",
    "total_stories": 156,
    "active_stories": 23,
    
    "stories": [
      {
        "story_id": "story_abc123def456",
        "title": "Bitcoin Reaches $70K",
        "category": "bitcoin",
        "importance": "high",
        "first_seen": "2025-10-05T08:30:00Z",  // When story first appeared
        "last_seen": "2025-10-12T14:30:00Z",   // Last time we saw it
        "is_active": true,                      // Still appearing in feeds
        "sources": [
          {
            "name": "CoinDesk",
            "url": "https://...",
            "timestamp": "2025-10-05T08:30:00Z"
          }
        ],
        "content_sample": "Bitcoin reached a new...",
        "tags": ["bitcoin", "price", "ath"],
        "url": "https://..."
      }
    ]
  }
}
```

## Usage

### Running the System

```bash
# Update current month's aggregate (run via cron every 2 hours)
python python/news_aggregator/monthly_aggregate_system.py

# Migrate existing raw feeds to aggregates (one-time)
python python/news_aggregator/migrate_to_aggregates.py
```

### In Production (Docker)

The Docker container automatically runs the aggregate updater every 2 hours via cron:
```
0 */2 * * * cd /app && python python/news_aggregator/monthly_aggregate_system.py
```

### Time Travel Queries

**Get current news:**
```javascript
// Load current month's aggregate
const response = await fetch('/news_feeds/2025/aggregate_2025_10.json');
const data = await response.json();

// Show all stories
const allStories = data.monthly_aggregate.stories;

// Show only active stories
const activeStories = allStories.filter(s => s.is_active);
```

**Get news from a specific date:**
```javascript
async function getNewsAtTime(targetDate) {
  const date = new Date(targetDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  // Load that month's aggregate
  const response = await fetch(`/news_feeds/${year}/aggregate_${year}_${month}.json`);
  const data = await response.json();
  
  // Filter stories active at target time
  return data.monthly_aggregate.stories.filter(story => {
    return story.first_seen <= targetDate && story.last_seen >= targetDate;
  });
}

// Example: What was in the news on July 15, 2025 at 2pm?
const news = await getNewsAtTime('2025-07-15T14:00:00Z');
```

## Migration Process

### One-Time Migration

Convert existing raw feeds (June-September 2025) to aggregates:

```bash
cd /path/to/astro_website
python python/news_aggregator/migrate_to_aggregates.py
```

This will:
1. Process ~614 raw feed files
2. Create 4 monthly aggregates
3. Reduce storage from 40MB to ~1.8MB
4. Preserve all story lifecycle data

### After Migration

**Option 1: Keep raw feeds for reference**
```bash
# Add to .gitignore to exclude from future commits
echo "public/news_feeds/2025/06/*.json" >> .gitignore
echo "public/news_feeds/2025/07/*.json" >> .gitignore
echo "public/news_feeds/2025/08/*.json" >> .gitignore
echo "public/news_feeds/2025/09/*.json" >> .gitignore
```

**Option 2: Remove raw feeds**
```bash
# Archive locally first (optional)
tar -czf news_feeds_raw_backup.tar.gz public/news_feeds/2025/*/news_feed_*.json

# Remove raw feeds
rm public/news_feeds/2025/06/news_feed_*.json
rm public/news_feeds/2025/07/news_feed_*.json
rm public/news_feeds/2025/08/news_feed_*.json
rm public/news_feeds/2025/09/news_feed_*.json

# Keep aggregates
git add public/news_feeds/2025/*/aggregate_*.json
git commit -m "Add monthly news aggregates (June-September 2025)"
```

## Benefits

### Storage Efficiency
- **Before**: 614 files, 40MB
- **After**: 4 files, 1.8MB
- **Savings**: 95.5%

### Query Capabilities
- Time travel: "What was news on this date?"
- Story lifecycle: "How long did this story run?"
- Source diversity: "Which sources covered this?"
- Activity patterns: "What stories were most persistent?"

### Operational Simplicity
- No archiving process needed
- No two-tier system (current vs historical)
- Single format for all time periods
- Continuous updates without file accumulation

## File Locations

```
public/news_feeds/
├── 2025/
│   ├── 06/
│   │   └── aggregate_2025_06.json  (~400KB, historical)
│   ├── 07/
│   │   └── aggregate_2025_07.json  (~500KB, historical)
│   ├── 08/
│   │   └── aggregate_2025_08.json  (~450KB, historical)
│   ├── 09/
│   │   └── aggregate_2025_09.json  (~480KB, historical)
│   └── 10/
│       └── aggregate_2025_10.json  (growing, is_current: true)
├── latest.json                     (symlink to current month)
└── index.json                      (index of all aggregates)
```

## Story Fingerprinting

Stories are identified using a sophisticated fingerprinting algorithm that extracts:
- **Entities**: Companies, technologies, currencies (bitcoin, openai, etc.)
- **Numbers**: Prices, versions, percentages ($70k, v2.0, 15%)
- **Actions**: Key verbs (release, announce, surge, crash)
- **Keywords**: Important terms (record, regulation, ath)
- **Category**: bitcoin, software_dev, ai_progress

Similar stories are matched even with different headlines across sources.

## Cross-Month Stories

Stories that span month boundaries appear in both months:
- September aggregate: `last_seen` in September
- October aggregate: `first_seen` in September, continuing into October

This provides complete context without duplication.

## API Integration

The web interface (`src/pages/news/index.astro`) automatically uses aggregates:
- Current view: loads current month's aggregate
- Time travel: loads appropriate month and filters by date
- No changes needed to existing code structure

## Monitoring

Check the system status:
```bash
# View update logs
tail -f monthly_aggregate.log

# Check current aggregate
cat public/news_feeds/2025/aggregate_2025_10.json | jq '.monthly_aggregate | {month, total_stories, active_stories, last_updated}'

# List all aggregates
ls -lh public/news_feeds/2025/aggregate_*.json
```

## Troubleshooting

### Aggregate not updating
1. Check cron job: `crontab -l`
2. Check logs: `cat monthly_aggregate.log`
3. Run manually: `python python/news_aggregator/monthly_aggregate_system.py`

### Migration failed
1. Check source directory: `ls -la public/news_feeds/2025/*/`
2. Verify Python dependencies: `pip list | grep -E "(feedparser|beautifulsoup4|requests|dateutil)"`
3. Run with debug: `python -u python/news_aggregator/migrate_to_aggregates.py`

### Story not deduplicating
- Stories need similar entities, numbers, and actions to match
- Adjust `similarity_threshold` in `StoryFingerprinter.__init__()` (default: 0.70)
- Check fingerprint generation in logs

## Future Enhancements

- **Compression**: gzip aggregates for even smaller storage
- **Snapshots**: Add periodic snapshots for faster time-travel queries
- **Analytics**: Generate monthly trend reports
- **API endpoints**: RESTful API for aggregate access
- **Search**: Full-text search across all stories

