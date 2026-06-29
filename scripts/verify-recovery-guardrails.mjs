#!/usr/bin/env node

import { execSync } from "node:child_process";

const baseRef = process.env.GUARDRAIL_BASE_REF || "origin/main";
const headRef = process.env.GUARDRAIL_HEAD_REF || "HEAD";
const maxFiles = Number(process.env.GUARDRAIL_MAX_FILES || "30");
const maxLines = Number(process.env.GUARDRAIL_MAX_LINES || "1200");

const forbiddenPaths = new Set([
  "app/components/presence-heartbeat.tsx",
]);

function run(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function toLines(value) {
  if (!value) return [];
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

let changedFiles = [];
let statLines = [];

try {
  changedFiles = toLines(run(`git diff --name-only ${baseRef}...${headRef}`));
  statLines = toLines(run(`git diff --numstat ${baseRef}...${headRef}`));
} catch (error) {
  console.error("[guardrails] Could not compute git diff range.");
  console.error(String(error));
  process.exit(1);
}

const forbiddenHits = changedFiles.filter((file) => forbiddenPaths.has(file));

let added = 0;
let deleted = 0;
for (const row of statLines) {
  const [a, d] = row.split(/\s+/);
  if (a !== "-") added += Number(a || 0);
  if (d !== "-") deleted += Number(d || 0);
}

const totalChangedLines = added + deleted;

const failures = [];

if (forbiddenHits.length > 0) {
  failures.push(
    `Forbidden paths modified: ${forbiddenHits.join(", ")}`
  );
}

if (changedFiles.length > maxFiles) {
  failures.push(
    `Too many files changed for recovery package: ${changedFiles.length} > ${maxFiles}`
  );
}

if (totalChangedLines > maxLines) {
  failures.push(
    `Too many changed lines for recovery package: ${totalChangedLines} > ${maxLines}`
  );
}

console.log(
  `[guardrails] files=${changedFiles.length}, lines=${totalChangedLines}, base=${baseRef}, head=${headRef}`
);

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[guardrails] FAIL: ${failure}`);
  }
  process.exit(1);
}

console.log("[guardrails] PASS");
