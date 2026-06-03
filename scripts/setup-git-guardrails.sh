#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

git config core.hooksPath .githooks
git config rerere.enabled true

echo "Git guardrails enabled in $repo_root"
echo "- core.hooksPath=$(git config --get core.hooksPath)"
echo "- rerere.enabled=$(git config --get rerere.enabled)"
