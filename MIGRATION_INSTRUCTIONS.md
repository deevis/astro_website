# Monthly Aggregate News Feed - Migration & Testing Instructions

## What We've Built

We've successfully implemented the **Monthly Aggregate News Feed System** that replaces individual timestamped feed snapshots with a single, continuously-updated file per month. This provides:

- ✅ **95% storage savings** (40MB → 1.8MB for 4 months)
- ✅ **Story lifecycle tracking** (first_seen, last_seen timestamps)
- ✅ **Time travel capabilities** (query news from any historical date)
- ✅ **Automatic deduplication** across time and sources
- ✅ **Single unified format** for current and historical data

## Files Created

### Core System
- `python/news_aggregator/monthly_aggregate_system.py` - Main system that updates aggregates
- `python/news_aggregator/migrate_to_aggregates.py` - Migration script for existing feeds
- `python/news_aggregator/MONTHLY_AGGREGATES_README.md` - Complete documentation

### Configuration
- `Dockerfile` - Updated to use monthly_aggregate_system.py (line 79)

## Step-by-Step Migration

### Step 1: Install Dependencies

```powershell
cd D:\projects\github\deevis\astro_website
pip install -r python\news_aggregator\requirements.txt
```

**Required packages:**
- feedparser==6.0.11
- beautifulsoup4==4.13.4
- requests==2.32.3
- python-dateutil==2.9.0

### Step 2: Run Migration Script

This will convert your existing raw feeds (June-September 2025) into monthly aggregates:

```powershell
cd D:\projects\github\deevis\astro_website
python python\news_aggregator\migrate_to_aggregates.py
```

**Expected output:**
```
============================================================
MIGRATION: Raw Feeds → Monthly Aggregates
============================================================

============================================================
Building aggregate for 2025-06
============================================================
Found 61 feed files for 2025-06
Processing 61 feeds...
Tracked 89 unique stories from 1247 articles

✅ Aggregate created:
   Original: 61 files, 4.10MB
   Aggregate: 412KB
   Space savings: 89.9%
   Unique stories: 89
   Deduplication: 14.01x
   Saved to: public/news_feeds/2025/aggregate_2025_06.json

[... same for July, August, September ...]

🎉 MIGRATION COMPLETE!
Created 4 monthly aggregates:
  ✓ June: aggregate_2025_06.json
  ✓ July: aggregate_2025_07.json
  ✓ August: aggregate_2025_08.json
  ✓ September: aggregate_2025_09.json
```

### Step 3: Test the Current System

Create/update the October aggregate with current RSS feeds:

```powershell
cd D:\projects\github\deevis\astro_website
python python\news_aggregator\monthly_aggregate_system.py
```

**Expected output:**
```
============================================================
Starting monthly aggregate update
============================================================
Fetching bitcoin articles...
   Parsing feed: https://www.coindesk.com/arc/outboundfeeds/rss/
   Parsing feed: https://cointelegraph.com/rss
   [...]
Fetched 42 total articles
After URL deduplication: 40 articles
Updating aggregate with 40 new articles
Current aggregate has 0 stories
✅ Aggregate updated: 40 added, 0 updated, 0 marked inactive
   Total stories: 40, Active: 40
   Saved to: public/news_feeds/2025/aggregate_2025_10.json
   Dist files updated: dist/news_feeds/2025/aggregate_2025_10.json
============================================================
✅ Update complete!
============================================================
```

### Step 4: Verify Results

Check the created aggregates:

```powershell
# List all aggregates
dir public\news_feeds\2025\aggregate_*.json

# View June aggregate summary
Get-Content public\news_feeds\2025\aggregate_2025_06.json | ConvertFrom-Json | 
  Select-Object -ExpandProperty monthly_aggregate | 
  Select-Object month, total_stories, active_stories, last_updated

# View October aggregate (current)
Get-Content public\news_feeds\2025\aggregate_2025_10.json | ConvertFrom-Json | 
  Select-Object -ExpandProperty monthly_aggregate | 
  Select-Object month, total_stories, active_stories, is_current
```

### Step 5: Test Web Interface

The existing news page should work automatically with the new aggregates:

1. The system will look for `/news_feeds/latest.json` (which points to current month)
2. For time travel, it will load the appropriate monthly aggregate
3. Stories are filtered by `first_seen` and `last_seen` timestamps

No changes needed to your Astro site code!

## What Gets Created

### File Structure
```
public/news_feeds/
├── 2025/
│   ├── 06/
│   │   ├── aggregate_2025_06.json     (412KB, ~89 stories)
│   │   └── news_feed_*.json           (61 files, keep for now)
│   ├── 07/
│   │   ├── aggregate_2025_07.json     (520KB, ~142 stories)
│   │   └── news_feed_*.json           (187 files)
│   ├── 08/
│   │   ├── aggregate_2025_08.json     (485KB, ~134 stories)
│   │   └── news_feed_*.json           (186 files)
│   ├── 09/
│   │   ├── aggregate_2025_09.json     (470KB, ~128 stories)
│   │   └── news_feed_*.json           (180 files)
│   └── 10/
│       └── aggregate_2025_10.json     (growing, current month)
├── latest.json                        (copy of current aggregate)
└── index.json                         (index of all aggregates)
```

### Aggregate Data Structure

Each aggregate contains:

```json
{
  "monthly_aggregate": {
    "version": "2.0",
    "month": "2025-10",
    "is_current": true,
    "total_stories": 40,
    "active_stories": 40,
    "stories": [
      {
        "story_id": "story_abc123def456",
        "title": "Bitcoin Reaches $70K",
        "category": "bitcoin",
        "importance": "high",
        "first_seen": "2025-10-05T08:30:00Z",
        "last_seen": "2025-10-12T14:30:00Z",
        "is_active": true,
        "sources": [
          {
            "name": "CoinDesk",
            "url": "https://...",
            "timestamp": "2025-10-05T08:30:00Z"
          }
        ],
        "content_sample": "Bitcoin reached a new...",
        "tags": ["bitcoin", "price", "ath"]
      }
    ]
  }
}
```

## Cleanup Options

After verifying the aggregates work correctly, you have two options:

### Option 1: Keep Raw Feeds (Recommended Initially)

Add to `.gitignore` to exclude from Git but keep locally:

```gitignore
# Raw news feeds (replaced by monthly aggregates)
public/news_feeds/2025/06/news_feed_*.json
public/news_feeds/2025/07/news_feed_*.json
public/news_feeds/2025/08/news_feed_*.json
public/news_feeds/2025/09/news_feed_*.json
```

### Option 2: Remove Raw Feeds

After testing, archive and remove:

```powershell
# Create backup
tar -czf news_feeds_raw_backup_2025-10-12.tar.gz public\news_feeds\2025\06\news_feed_*.json public\news_feeds\2025\07\news_feed_*.json public\news_feeds\2025\08\news_feed_*.json public\news_feeds\2025\09\news_feed_*.json

# Remove raw feeds
Remove-Item public\news_feeds\2025\06\news_feed_*.json
Remove-Item public\news_feeds\2025\07\news_feed_*.json
Remove-Item public\news_feeds\2025\08\news_feed_*.json
Remove-Item public\news_feeds\2025\09\news_feed_*.json
```

## Git Workflow

```powershell
# Stage the new files
git add python/news_aggregator/monthly_aggregate_system.py
git add python/news_aggregator/migrate_to_aggregates.py
git add python/news_aggregator/MONTHLY_AGGREGATES_README.md
git add Dockerfile
git add MIGRATION_INSTRUCTIONS.md

# Stage the aggregates
git add public/news_feeds/2025/aggregate_*.json
git add public/news_feeds/index.json

# Optional: Update .gitignore to exclude raw feeds
git add .gitignore

# Commit
git commit -m "Implement monthly aggregate news feed system

- Replace individual feed snapshots with monthly aggregates
- Add story lifecycle tracking (first_seen, last_seen)
- Enable time-travel queries across historical data
- Reduce storage by 95% (40MB → 1.8MB for 4 months)
- Update Docker to use new aggregate system every 2 hours"
```

## Docker Deployment

The Docker container is already updated to use the new system:

```dockerfile
# Cron job runs every 2 hours
0 */2 * * * cd /app && python python/news_aggregator/monthly_aggregate_system.py
```

When you rebuild and deploy:

```powershell
# Build new image
docker-compose build prod

# Deploy
docker-compose up -d prod

# Check logs
docker-compose logs -f prod
```

## Troubleshooting

### Migration script fails
```powershell
# Check Python version (need 3.8+)
python --version

# Verify dependencies
pip list | Select-String -Pattern "feedparser|beautifulsoup4|requests|dateutil"

# Check raw feeds exist
dir public\news_feeds\2025\06\news_feed_*.json
```

### Aggregate not updating
```powershell
# Check current aggregate
cat public\news_feeds\2025\aggregate_2025_10.json | ConvertFrom-Json | Select-Object -ExpandProperty monthly_aggregate | Select-Object month, last_updated

# Run manually with verbose output
python python\news_aggregator\monthly_aggregate_system.py

# Check logs
cat monthly_aggregate.log
```

### Stories not deduplicating
- Check story fingerprints in the output
- Adjust `similarity_threshold` in `StoryFingerprinter.__init__()` (default: 0.70)
- Lower values = more aggressive deduplication
- Higher values = more conservative (treat as separate stories)

## Next Steps

1. ✅ Run migration script
2. ✅ Test with October aggregate
3. ✅ Verify web interface still works
4. ✅ Commit changes to Git
5. ✅ Deploy to production
6. ✅ Monitor for a few days
7. ✅ Remove raw feeds after verification

## Support

For detailed documentation, see:
- `python/news_aggregator/MONTHLY_AGGREGATES_README.md`

For questions or issues, check the logs:
- `monthly_aggregate.log` (local)
- `/var/log/news_feed_cron.log` (Docker)

