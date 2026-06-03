import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { requireTenantRoles } from "@/lib/server-permissions";

type VercelRequestLogRow = {
  requestId?: string;
  timestamp?: string;
  deploymentId?: string;
  domain?: string;
  requestMethod?: string;
  requestPath?: string;
  statusCode?: number;
  environment?: string;
  branch?: string;
  cache?: string;
  traceId?: string;
  logs?: Array<{
    level?: string;
    message?: string;
    messageTruncated?: boolean;
  }>;
  events?: Array<{
    source?: string;
  }>;
};

type VercelRequestLogsResponse = {
  rows?: VercelRequestLogRow[];
  hasMoreRows?: boolean;
};

function parseSince(value: string | null): number {
  const now = Date.now();
  if (!value) return now - 60 * 60 * 1000;

  const trimmed = value.trim();
  const relativeMatch = trimmed.match(/^(\d+)(m|h|d)$/i);
  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unit = relativeMatch[2].toLowerCase();
    const multiplier = unit === "m" ? 60 * 1000 : unit === "h" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    return now - amount * multiplier;
  }

  const parsedDate = new Date(trimmed);
  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.getTime();
  }

  return now - 60 * 60 * 1000;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await requireTenantRoles(session, ["ADMIN", "MODERATOR"]);
  if ("error" in auth) return auth.error;

  const token = process.env.VERCEL_LOGS_TOKEN || process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const ownerId = process.env.VERCEL_TEAM_ID || process.env.VERCEL_ORG_ID;

  if (!token) {
    return NextResponse.json(
      { error: "Runtime-Logs nicht konfiguriert (VERCEL_LOGS_TOKEN/VERCEL_TOKEN fehlt)." },
      { status: 503 },
    );
  }

  if (!projectId || !ownerId) {
    return NextResponse.json(
      { error: "Runtime-Logs nicht konfiguriert (VERCEL_PROJECT_ID und/oder VERCEL_TEAM_ID/VERCEL_ORG_ID fehlt)." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 200);
  const statusCode = url.searchParams.get("statusCode")?.trim() || "500";
  const environment = url.searchParams.get("environment")?.trim() || "production";
  const search = url.searchParams.get("search")?.trim();
  const branch = url.searchParams.get("branch")?.trim();
  const level = url.searchParams.get("level")?.trim() || "error";

  const query = new URLSearchParams();
  query.set("projectId", projectId);
  query.set("ownerId", ownerId);
  query.set("page", "0");
  query.set("startDate", String(parseSince(url.searchParams.get("since"))));
  query.set("endDate", String(Date.now()));
  query.set("environment", environment);
  query.set("statusCode", statusCode);
  query.set("level", level);
  if (search) query.set("search", search);
  if (branch) query.set("branch", branch);

  const response = await fetch(`https://vercel.com/api/logs/request-logs?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return NextResponse.json(
      { error: "Vercel Runtime-Logs konnten nicht geladen werden.", detail },
      { status: 502 },
    );
  }

  const data = (await response.json()) as VercelRequestLogsResponse;
  const logs = (data.rows || [])
    .slice(0, limit)
    .map((row) => {
      const firstLog = row.logs?.[0];
      const firstEvent = row.events?.[0];
      return {
        id: row.requestId || "",
        timestamp: row.timestamp || null,
        deploymentId: row.deploymentId || "",
        level: firstLog?.level || "info",
        message: firstLog?.message || "",
        messageTruncated: firstLog?.messageTruncated === true,
        source: firstEvent?.source || "static",
        domain: row.domain || "",
        requestMethod: row.requestMethod || "",
        requestPath: row.requestPath || "",
        responseStatusCode: row.statusCode || 0,
        environment: row.environment || environment,
        branch: row.branch || "",
        cache: row.cache || "",
        traceId: row.traceId || "",
      };
    });

  return NextResponse.json({
    logs,
    hasMoreRows: data.hasMoreRows === true,
    filters: { limit, statusCode, environment, search: search || "", branch: branch || "", level },
  });
}

