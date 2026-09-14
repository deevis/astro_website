#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

if [ -z "${PUBLIC_GA_MEASUREMENT_ID:-}" ]; then
  echo "WARNING: PUBLIC_GA_MEASUREMENT_ID is not set. Google Analytics will be omitted from this image."
else
  echo "Using PUBLIC_GA_MEASUREMENT_ID=${PUBLIC_GA_MEASUREMENT_ID}"
fi

docker build --build-arg PUBLIC_GA_MEASUREMENT_ID="${PUBLIC_GA_MEASUREMENT_ID:-}" -t astro-website .
docker save -o astro-website.tar astro-website
