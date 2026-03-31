#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(pwd)}"
BAD_VERSIONS=("1.14.1" "0.30.4")
BAD_DEP="plain-crypto-js"
C2_IP="142.11.206.73"
C2_DOMAIN="sfrclak.com"
EXIT_CODE=0

log() {
  printf '%s\n' "$1"
}

check_lockfile() {
  local lockfile=$1
  [[ -f "$lockfile" ]] || return 0
  for version in "${BAD_VERSIONS[@]}"; do
    if grep -q "axios@$version" "$lockfile"; then
      log "[ALERT] $lockfile references axios@$version"
      EXIT_CODE=1
    fi
  done
  if grep -q "$BAD_DEP" "$lockfile"; then
    log "[ALERT] $lockfile references suspicious dependency $BAD_DEP"
    EXIT_CODE=1
  fi
}

check_node_modules() {
  local pkg_json
  while IFS= read -r pkg_json; do
    local version
    version=$(grep -m1 '"version"' "$pkg_json" | sed -E 's/.*"version"\s*:\s*"([^"]+)".*/\1/')
    for bad in "${BAD_VERSIONS[@]}"; do
      if [[ "$version" == "$bad" ]]; then
        log "[ALERT] $(dirname "$pkg_json") -> axios@$version"
        EXIT_CODE=1
      fi
    done
  done < <(find "$ROOT_DIR" -path "*/node_modules/axios/package.json" 2>/dev/null)
}

check_rat_artifacts() {
  local path=$1 label=$2
  if [[ -e "$path" ]]; then
    log "[ALERT] $label artifact present at $path"
    EXIT_CODE=1
  fi
}

log "🔍 Running axios supply-chain audit in $ROOT_DIR"
check_lockfile "$ROOT_DIR/package-lock.json"
check_lockfile "$ROOT_DIR/pnpm-lock.yaml"
check_lockfile "$ROOT_DIR/yarn.lock"
check_node_modules

# RAT indicators (best effort)
check_rat_artifacts "/tmp/ld.py" "Linux RAT"
check_rat_artifacts "/Library/Caches/com.apple.act.mond" "macOS RAT"
check_rat_artifacts "/ProgramData/wt.exe" "Windows RAT"

if netstat -an 2>/dev/null | grep -q "$C2_IP"; then
  log "[ALERT] Active connection to $C2_IP detected"
  EXIT_CODE=1
fi

if netstat -an 2>/dev/null | grep -qi "$C2_DOMAIN"; then
  log "[ALERT] Active connection to $C2_DOMAIN detected"
  EXIT_CODE=1
fi

if [[ $EXIT_CODE -eq 0 ]]; then
  log "✅ No indicators of the axios compromise detected"
else
  log "❌ Indicators detected – treat host as compromised"
fi

exit $EXIT_CODE
