FROM node:18-slim as base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base as deps
COPY package.json ./
RUN pnpm install

FROM base as builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base as runner
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

EXPOSE 4321
CMD ["pnpm", "start"]