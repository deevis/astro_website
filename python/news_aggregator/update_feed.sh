#!/bin/bash
# Production News Feed Update Script with Timestamping

echo "🚀 Production News Feed System (6-hour intervals)"
echo "Timestamp: $(date)"
echo "================================"

# Change to script directory
cd "$(dirname "$0")"

# Run the news feed system
echo "Checking if update is needed..."
python3 news_feed_system.py

# Check if successful
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ News feed system completed!"
    
    # Find most recent timestamped file across all subdirectories
    latest_file=$(find ../../public/news_feeds -name "news_feed_*.json" 2>/dev/null | xargs ls -t 2>/dev/null | head -n1)
    
    # Fallback to current directory for legacy files
    if [ -z "$latest_file" ]; then
        latest_file=$(ls -t news_feed_*.json 2>/dev/null | head -n1)
    fi
    
    if [ -n "$latest_file" ]; then
        echo "📁 Latest file: $latest_file"
        echo "📊 File size: $(du -h "$latest_file" | cut -f1)"
        echo "🕒 Last modified: $(stat -c %y "$latest_file" 2>/dev/null || stat -f %Sm "$latest_file")"
    fi
else
    echo ""
    echo "❌ News feed system failed!"
    echo "📋 Check news_feed.log for details"
    exit 1
fi

