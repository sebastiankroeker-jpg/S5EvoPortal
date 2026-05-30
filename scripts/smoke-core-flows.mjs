#!/usr/bin/env node

const baseUrl = (process.env.SMOKE_BASE_URL || "https://portal.s5evo.de").replace(/\/+$/, "");
const legacyUrl = process.env.SMOKE_LEGACY_URL || "https://s5-evo-portal.vercel.app";
const expectedRedirectHost = new URL(baseUrl).host;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    response,
    text,
    json,
  };
}

async function fetchHead(path) {
  const response = await fetch(baseUrl + path, {
    method: "HEAD",
    redirect: "manual",
  });

  return response;
}

async function main() {
  const checks = [];

  const root = await fetchHead("/");
  assert(root.status === 200, `GET / expected 200, got ${root.status}`);
  checks.push("/ -> 200");

  const login = await fetchHead("/login");
  assert(login.status === 200, `GET /login expected 200, got ${login.status}`);
  checks.push("/login -> 200");

  const registration = await fetchHead("/anmeldung");
  assert(registration.status === 200, `GET /anmeldung expected 200, got ${registration.status}`);
  checks.push("/anmeldung -> 200");

  const changes = await fetchHead("/aenderungen");
  assert(changes.status === 200, `GET /aenderungen expected 200, got ${changes.status}`);
  checks.push("/aenderungen -> 200");

  const legacyRoot = await fetch(legacyUrl + "/", {
    method: "HEAD",
    redirect: "manual",
  });
  assert(legacyRoot.status === 308, `${legacyUrl}/ expected 308, got ${legacyRoot.status}`);
  assert(
    legacyRoot.headers.get("location")?.includes(expectedRedirectHost),
    `${legacyUrl}/ did not redirect to ${expectedRedirectHost}`,
  );
  checks.push("legacy domain -> 308 to production");

  const competitionResult = await fetchJson(baseUrl + "/api/competition");
  assert(competitionResult.response.status === 200, `/api/competition expected 200, got ${competitionResult.response.status}`);
  assert(competitionResult.json?.competition?.id, "/api/competition did not return competition.id");
  assert(competitionResult.json?.competition?.status, "/api/competition did not return competition.status");
  const competitionId = competitionResult.json.competition.id;
  checks.push("/api/competition -> 200");

  const resultsResult = await fetchJson(
    `${baseUrl}/api/results?competitionId=${encodeURIComponent(competitionId)}`,
  );
  assert(resultsResult.response.status === 200, `/api/results expected 200, got ${resultsResult.response.status}`);
  assert(Array.isArray(resultsResult.json?.results), "/api/results did not return results array");
  assert(typeof resultsResult.json?.totalTeams === "number", "/api/results did not return totalTeams");
  checks.push("/api/results -> 200");

  const teamsUnauthorized = await fetch(baseUrl + "/api/teams", {
    redirect: "manual",
  });
  assert(teamsUnauthorized.status === 401, `/api/teams without session expected 401, got ${teamsUnauthorized.status}`);
  checks.push("/api/teams -> 401 without session");

  const pendingChangesUnauthorized = await fetch(baseUrl + "/api/admin/pending-changes", {
    redirect: "manual",
  });
  assert(
    pendingChangesUnauthorized.status === 401,
    `/api/admin/pending-changes without session expected 401, got ${pendingChangesUnauthorized.status}`,
  );
  checks.push("/api/admin/pending-changes -> 401 without session");

  process.stdout.write(`Smoke ok for ${baseUrl}\n`);
  for (const check of checks) {
    process.stdout.write(`- ${check}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`Smoke failed for ${baseUrl}\n${error.message}\n`);
  process.exitCode = 1;
});
