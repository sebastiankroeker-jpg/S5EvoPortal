import { NextRequest, NextResponse } from "next/server";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function proxy(request: NextRequest) {
  const maintenanceMode = process.env.PORTAL_MAINTENANCE_MODE === "1";

  if (
    maintenanceMode &&
    request.nextUrl.pathname.startsWith("/api/") &&
    MUTATING_METHODS.has(request.method)
  ) {
    return NextResponse.json(
      {
        error: "maintenance_mode",
        message: "Das Portal ist derzeit wegen Wartungsarbeiten geschlossen.",
      },
      {
        status: 503,
        headers: {
          "Retry-After": "3600",
        },
      },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
