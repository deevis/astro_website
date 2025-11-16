#!/bin/bash
# Update Bitcoin OP_RETURN data directly in dist
# This script clones/updates the deevis/bitcoin_large_op_returns repo in dist

DIST_DIR="/app/dist/html_showcase/bitcoin_large_op_return_explorer"
REPO_URL="https://github.com/deevis/bitcoin_large_op_returns.git"
TARGET_DIR="$DIST_DIR/bitcoin_large_op_returns"

# Ensure dist directory exists
if [ ! -d "$DIST_DIR" ]; then
    echo "Error: Dist directory does not exist: $DIST_DIR"
    exit 1
fi

cd "$DIST_DIR" || exit 1

# Clone if doesn't exist, otherwise pull
if [ ! -d "$TARGET_DIR/.git" ]; then
    echo "Cloning bitcoin_large_op_returns repository..."
    rm -rf "$TARGET_DIR"  # Remove any existing directory
    git clone --depth 1 "$REPO_URL" "$TARGET_DIR" || exit 1
else
    echo "Updating bitcoin_large_op_returns repository..."
    cd "$TARGET_DIR" || exit 1
    git pull origin main || exit 1
fi

exit $?

