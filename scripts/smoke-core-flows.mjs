#!/usr/bin/env node

// Optional auth coverage:
// - SMOKE_NON_ADMIN_COOKIE="next-auth.session-token=..."
// - SMOKE_ADMIN_COOKIE="next-auth.session-token=..."
// - SMOKE_REQUIRE_AUTH_CHECKS=1 to fail when neither auth cookie is provided
const baseUrl = (process.env.SMOKE_BASE_URL || "https://portal.s5evo.de").replace(/\/+$/, "");
const legacyUrl = process.env.SMOKE_LEGACY_URL || "https://s5-evo-portal.vercel.app";
const expectedRedirectHost = new URL(baseUrl).host;
const adminCookie = normalizeCookie(process.env.SMOKE_ADMIN_COOKIE);
const nonAdminCookie = normalizeCookie(process.env.SMOKE_NON_ADMIN_COOKIE);
const requireAuthChecks = isTruthy(process.env.SMOKE_REQUIRE_AUTH_CHECKS);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeCookie(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isTruthy(value) {
  return typeof value === "string" && ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function withCookie(init = {}, cookie) {
  if (!cookie) {
    return init;
  }

  return {
    ...init,
    headers: {
      ...(init.headers || {}),
      cookie,
    },
  };
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

async function runNonAdminChecks({ checks, competitionId }) {
  assert(nonAdminCookie, "SMOKE_NON_ADMIN_COOKIE is required for non-admin auth checks");

  const profileResult = await fetchJson(baseUrl + "/api/profile", withCookie({}, nonAdminCookie));
  assert(profileResult.response.status === 200, `/api/profile expected 200, got ${profileResult.response.status}`);
  assert(profileResult.json?.user?.id, "/api/profile did not return user.id");
  assert(typeof profileResult.json?.user?.email === "string", "/api/profile did not return user.email");
  checks.push("/api/profile -> 200 with non-admin session");

  const rolesResult = await fetchJson(baseUrl + "/api/profile/roles", withCookie({}, nonAdminCookie));
  assert(rolesResult.response.status === 200, `/api/profile/roles expected 200, got ${rolesResult.response.status}`);
  assert(Array.isArray(rolesResult.json?.roles), "/api/profile/roles did not return roles array");
  checks.push("/api/profile/roles -> 200 with non-admin session");

  const teamsResult = await fetchJson(
    `${baseUrl}/api/teams?competitionId=${encodeURIComponent(competitionId)}`,
    withCookie({}, nonAdminCookie),
  );
  assert(teamsResult.response.status === 200, `/api/teams expected 200 for non-admin session, got ${teamsResult.response.status}`);
  assert(Array.isArray(teamsResult.json?.teams), "/api/teams did not return teams array for non-admin session");
  checks.push("/api/teams -> 200 with non-admin session");

  const pendingChangesForbidden = await fetchJson(
    baseUrl + "/api/admin/pending-changes",
    withCookie({}, nonAdminCookie),
  );
  assert(
    pendingChangesForbidden.response.status === 403,
    `/api/admin/pending-changes expected 403 for non-admin session, got ${pendingChangesForbidden.response.status}`,
  );
  checks.push("/api/admin/pending-changes -> 403 with non-admin session");
}

async function runAdminChecks({ checks }) {
  assert(adminCookie, "SMOKE_ADMIN_COOKIE is required for admin auth checks");

  const rolesResult = await fetchJson(baseUrl + "/api/profile/roles", withCookie({}, adminCookie));
  assert(rolesResult.response.status === 200, `/api/profile/roles expected 200, got ${rolesResult.response.status}`);
  assert(Array.isArray(rolesResult.json?.roles), "/api/profile/roles did not return roles array for admin session");
  assert(
    rolesResult.json.roles.includes("ADMIN") || rolesResult.json.roles.includes("MODERATOR"),
    "/api/profile/roles did not expose an elevated role for admin session",
  );
  checks.push("/api/profile/roles -> elevated role with admin session");

  const pendingChangesResult = await fetchJson(
    `${baseUrl}/api/admin/pending-changes?scope=all`,
    withCookie({}, adminCookie),
  );
  assert(
    pendingChangesResult.response.status === 200,
    `/api/admin/pending-changes expected 200 for admin session, got ${pendingChangesResult.response.status}`,
  );
  assert(Array.isArray(pendingChangesResult.json?.changes), "/api/admin/pending-changes did not return changes array");
  checks.push("/api/admin/pending-changes -> 200 with admin session");

  const participantsResult = await fetchJson(
    baseUrl + "/api/admin/participants",
    withCookie({}, adminCookie),
  );
  assert(
    participantsResult.response.status === 200,
    `/api/admin/participants expected 200 for admin session, got ${participantsResult.response.status}`,
  );
  assert(Array.isArray(participantsResult.json?.participants), "/api/admin/participants did not return participants array");
  assert(typeof participantsResult.json?.total === "number", "/api/admin/participants did not return total");
  checks.push("/api/admin/participants -> 200 with admin session");
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

  if (nonAdminCookie) {
    await runNonAdminChecks({ checks, competitionId });
  } else {
    checks.push("non-admin auth checks skipped (set SMOKE_NON_ADMIN_COOKIE)");
  }

  if (adminCookie) {
    await runAdminChecks({ checks });
  } else {
    checks.push("admin auth checks skipped (set SMOKE_ADMIN_COOKIE)");
  }

  if (requireAuthChecks) {
    assert(nonAdminCookie || adminCookie, "SMOKE_REQUIRE_AUTH_CHECKS is set, but no auth cookies were provided");
  }

  process.stdout.write(`Smoke ok for ${baseUrl}\n`);
  for (const check of checks) {
    process.stdout.write(`- ${check}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`Smoke failed for ${baseUrl}\n${error.message}\n`);
  process.exitCode = 1;
});
