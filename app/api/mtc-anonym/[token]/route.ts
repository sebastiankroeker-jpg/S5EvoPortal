import { NextRequest, NextResponse } from "next/server";

import { getMtcAnonymousPayload, updateMtcAnonymousTeam } from "@/lib/mtc-anonymous-access";

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const result = await getMtcAnonymousPayload(request, token);

  if ("error" in result) {
    return jsonNoStore({ error: result.error }, { status: result.status });
  }

  return jsonNoStore(result.payload);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await request.json().catch(() => ({}));
  const result = await updateMtcAnonymousTeam(request, token, body);

  if ("error" in result) {
    const responseBody: Record<string, unknown> = { error: result.error };
    if ("blockingErrors" in result) responseBody.blockingErrors = result.blockingErrors;
    if ("disciplineWarnings" in result) responseBody.disciplineWarnings = result.disciplineWarnings;
    return jsonNoStore(responseBody, { status: result.status });
  }

  return jsonNoStore(result.payload);
}
