FROM node:18-slim as base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Install Python, cron, and other system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    cron \
    && rm -rf /var/lib/apt/lists/*

# Media stage - these layers will be cached and reused across builds
# as long as the media files don't change
FROM base as media
WORKDIR /app
# Create directories to ensure they exist
RUN mkdir -p public/images/gallery public/mp4
# Copy large media directories first
COPY public/mp4 ./public/mp4
COPY public/images/gallery ./public/images/gallery

# Dependencies stage
FROM base as deps
COPY package.json package-lock.json astro.config.mjs tsconfig.json tailwind.config.mjs ./  
RUN pnpm install

# Python dependencies stage
FROM base as python-deps
COPY python/news_aggregator/requirements.txt ./python/news_aggregator/
RUN python3 -m venv /opt/news_feed_env && \
    /opt/news_feed_env/bin/pip install --upgrade pip && \
    /opt/news_feed_env/bin/pip install -r python/news_aggregator/requirements.txt

# Builder stage
FROM base as builder
# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=python-deps /opt/news_feed_env /opt/news_feed_env

# Create directory structure first
RUN mkdir -p public/images public/news_feeds
# Copy all source code EXCEPT the heavy media directories
COPY src ./src
COPY public ./public
# Remove the directories that will be replaced with the media stage content
RUN rm -rf ./public/images/gallery ./public/mp4

# Copy media files from the media stage
COPY --from=media /app/public/images/gallery ./public/images/gallery
COPY --from=media /app/public/mp4 ./public/mp4

# Copy Python news aggregator
COPY python/news_aggregator/ ./python/news_aggregator/

# Copy remaining config files
COPY *.js *.json *.mjs *.astro ./.gitignore* ./
# Build the application
RUN pnpm build

# Runner stage - the final image
FROM base as runner
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/python ./python
COPY --from=deps /app/node_modules ./node_modules
COPY --from=python-deps /opt/news_feed_env /opt/news_feed_env
COPY package.json package-lock.json astro.config.mjs tsconfig.json tailwind.config.mjs ./ 
RUN corepack enable && corepack prepare --activate

# Set up environment variables for Python
ENV VIRTUAL_ENV=/opt/news_feed_env
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
ENV PYTHONPATH="/app/python/news_aggregator:$PYTHONPATH"

# Create cron jobs for both news feed and Bitcoin price updates
RUN echo "0 */2 * * * cd /app && /opt/news_feed_env/bin/python python/news_aggregator/monthly_aggregate_system.py >> /var/log/news_feed_cron.log 2>&1" > /etc/cron.d/automated-updates && \
    echo "0 */4 * * * cd /app && /opt/news_feed_env/bin/python python/bitcoin/populate_price_histories.py >> /var/log/bitcoin_price_cron.log 2>&1" >> /etc/cron.d/automated-updates && \
    chmod 0644 /etc/cron.d/automated-updates && \
    crontab /etc/cron.d/automated-updates && \
    touch /var/log/news_feed_cron.log && \
    touch /var/log/bitcoin_price_cron.log

# Create startup script
RUN echo '#!/bin/bash\n\
# Start cron daemon\n\
cron\n\
\n\
# Start the main application\n\
exec pnpm start\n\
' > /app/start.sh && chmod +x /app/start.sh

EXPOSE 4321
CMD ["/app/start.sh"]