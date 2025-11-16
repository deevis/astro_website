#!/bin/bash
# Update Bitcoin OP_RETURN data submodule
# This script updates the bitcoin_large_op_returns submodule to pull the latest data

cd /app/public/html_showcase/bitcoin_large_op_return_explorer || exit 1

# Initialize submodule if not already initialized
if [ ! -d "bitcoin_large_op_returns/.git" ]; then
    git submodule update --init bitcoin_large_op_returns || exit 1
fi

# Update submodule to latest (no credentials needed for public repo)
git submodule update --remote bitcoin_large_op_returns

exit $?

