#!/bin/bash
# S5Evo Deploy Script — pushes build output to portal.s5evo.de
# Security: IONOS SSH key is restricted to rsync into /portal/ only
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SSH_KEY="$SCRIPT_DIR/.ssh/ionos-deploy"
IONOS_HOST="a1686294@access-5017198486.webspace-host.com"
REMOTE_DIR="./portal/"

# Source directory: where the built site lives
BUILD_DIR="${1:-$SCRIPT_DIR/build}"

if [ ! -d "$BUILD_DIR" ]; then
    echo "❌ Build directory not found: $BUILD_DIR"
    echo "Usage: ./deploy.sh [build-directory]"
    echo "Default: ./build/"
    exit 1
fi

echo "🚀 Deploying to portal.s5evo.de..."
echo "   Source: $BUILD_DIR"
echo "   Target: $IONOS_HOST:$REMOTE_DIR"

rsync -avz --delete \
    -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new" \
    "$BUILD_DIR/" \
    "$IONOS_HOST:$REMOTE_DIR"

echo "✅ Deploy complete → https://portal.s5evo.de"
