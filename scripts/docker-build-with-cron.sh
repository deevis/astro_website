#!/bin/bash
# Docker build script with news feed cron setup

echo "🐳 Building Docker image with news feed cron job..."
echo "================================"

# Build the Docker image
docker build -t astro-website-with-cron .

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Docker image built successfully!"
    echo ""
    echo "📋 To run the container:"
    echo "   docker run -p 4321:4321 astro-website-with-cron"
    echo ""
    echo "📋 To run in background:"
    echo "   docker run -d -p 4321:4321 --name astro-website astro-website-with-cron"
    echo ""
    echo "📋 To check cron logs:"
    echo "   docker exec astro-website tail -f /var/log/news_feed_cron.log"
    echo ""
    echo "📋 To manually trigger news feed update:"
    echo "   docker exec astro-website /opt/news_feed_env/bin/python /app/python/news_aggregator/news_feed_system.py"
else
    echo ""
    echo "❌ Docker build failed!"
    exit 1
fi 