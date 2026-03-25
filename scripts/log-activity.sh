#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="/home/ocadmin/.openclaw/workspace/activity.jsonl"

usage() {
  cat <<EOF
Usage:
  log-activity <type> <summary> [--scope P10] [--runId ID] [--status success|fail|running] [--actor NAME]

Examples:
  log-activity build.start "Vercel build started" --scope P10 --runId vercel-123
  log-activity build.end "Deploy ok" --scope P10 --runId vercel-123 --status success
EOF
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" || $# -lt 2 ]]; then
  usage
  exit 0
fi

type="$1"; shift
summary="$1"; shift

scope=""
runId=""
status=""
actor="s5evo"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scope) scope="$2"; shift 2;;
    --runId|--runid) runId="$2"; shift 2;;
    --status) status="$2"; shift 2;;
    --actor) actor="$2"; shift 2;;
    *) echo "Unknown arg: $1"; usage; exit 1;;
  esac
done

ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

python3 - <<PY
import json, os
obj = {
  "ts": "${ts}",
  "actor": "${actor}",
  "type": "${type}",
  "summary": "${summary}",
}
if "${scope}": obj["scope"] = "${scope}"
if "${runId}": obj["runId"] = "${runId}"
if "${status}": obj["status"] = "${status}"
line = json.dumps(obj, ensure_ascii=False)
path = "${LOG_FILE}"
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "a", encoding="utf-8") as f:
  f.write(line + "\n")
print(line)
PY
