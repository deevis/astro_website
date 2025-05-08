FROM node:18-slim as base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

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

# Builder stage
FROM base as builder
# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Create directory structure first
RUN mkdir -p public/images
# Copy all source code EXCEPT the heavy media directories
COPY src ./src
COPY public ./public
# Remove the directories that will be replaced with the media stage content
RUN rm -rf ./public/images/gallery ./public/mp4

# Copy media files from the media stage
COPY --from=media /app/public/images/gallery ./public/images/gallery
COPY --from=media /app/public/mp4 ./public/mp4

# Copy remaining config files
COPY *.js *.json *.mjs *.astro ./.gitignore* ./
# Build the application
RUN pnpm build

# Runner stage - the final image
FROM base as runner
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json astro.config.mjs tsconfig.json tailwind.config.mjs ./ 
RUN corepack enable && corepack prepare --activate

EXPOSE 4321
CMD ["pnpm", "start"]