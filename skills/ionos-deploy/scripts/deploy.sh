#!/bin/bash
# IONOS Deploy — rsync to configured targets
# Usage: deploy.sh <target-name> <build-dir> <ssh-key> [--dry-run]
set -euo pipefail

TARGET_NAME="${1:?Usage: deploy.sh <target> <build-dir> <ssh-key> [--dry-run]}"
BUILD_DIR="${2:?Missing build directory}"
SSH_KEY="${3:?Missing SSH key path}"
DRY_RUN=""
[[ "${4:-}" == "--dry-run" ]] && DRY_RUN="--dry-run"

# --- Target registry (add new targets here) ---
declare -A TARGETS=(
    ["portal.s5evo.de"]="a1686294@access-5017198486.webspace-host.com:./portal/"
    ["alois.cloud"]="a1686294@access-5017198486.webspace-host.com:./alois-cloud/"
)

if [[ -z "${TARGETS[$TARGET_NAME]+x}" ]]; then
    echo "❌ Unknown target: $TARGET_NAME"
    echo "Available targets: ${!TARGETS[*]}"
    exit 1
fi

REMOTE="${TARGETS[$TARGET_NAME]}"
IONOS_HOST="${REMOTE%%:*}"
REMOTE_DIR="${REMOTE#*:}"

# --- Pre-deploy checks ---
if [ ! -d "$BUILD_DIR" ]; then
    echo "❌ Build directory not found: $BUILD_DIR"
    exit 1
fi

if [ ! -f "$SSH_KEY" ]; then
    echo "❌ SSH key not found: $SSH_KEY"
    exit 1
fi

# Check for secrets (basic patterns)
if grep -rqE '(PRIVATE KEY|sk-[a-zA-Z0-9]{20,}|password\s*[:=])' "$BUILD_DIR/" 2>/dev/null; then
    echo "❌ ABORT: Potential secrets detected in build directory!"
    echo "   Run: grep -rE '(PRIVATE KEY|sk-|password)' $BUILD_DIR/"
    exit 1
fi

# Check index.html exists
if [ ! -f "$BUILD_DIR/index.html" ]; then
    echo "⚠️  Warning: No index.html in build directory"
fi

# Size check (warn if >50MB)
BUILD_SIZE=$(du -sm "$BUILD_DIR" | cut -f1)
if [ "$BUILD_SIZE" -gt 50 ]; then
    echo "⚠️  Warning: Build directory is ${BUILD_SIZE}MB (>50MB)"
fi

echo "🚀 Deploying to $TARGET_NAME..."
echo "   Source: $BUILD_DIR"
echo "   Target: $IONOS_HOST:$REMOTE_DIR"
[[ -n "$DRY_RUN" ]] && echo "   Mode: DRY RUN"

rsync -avz --delete $DRY_RUN \
    -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15" \
    "$BUILD_DIR/" \
    "$IONOS_HOST:$REMOTE_DIR"

echo ""

# --- Post-deploy verify ---
if [[ -z "$DRY_RUN" ]]; then
    echo "🔍 Verifying deployment..."
    HTTP_CODE=$(curl -so /dev/null -w "%{http_code}" --max-time 10 "https://$TARGET_NAME" 2>/dev/null || echo "000")
    if [[ "$HTTP_CODE" == "200" ]]; then
        echo "✅ Deploy verified → https://$TARGET_NAME (HTTP $HTTP_CODE)"
    elif [[ "$HTTP_CODE" == "000" ]]; then
        echo "⚠️  Could not verify (DNS/network issue?) → check https://$TARGET_NAME manually"
    else
        echo "⚠️  Deploy done but got HTTP $HTTP_CODE → check https://$TARGET_NAME"
    fi
else
    echo "✅ Dry run complete (no files transferred)"
fi
