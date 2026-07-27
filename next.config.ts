import type { NextConfig } from "next";

const isStaticExport = process.env.NEXT_OUTPUT_MODE === "export";

const noIndexHeader = {
  key: "X-Robots-Tag",
  value: "noindex, nofollow, noarchive",
};

const sensitiveRoutePatterns = [
  "/",
  "/teilnehmer",
  "/anmeldung",
  "/aenderungen",
  "/claim-links",
  "/claim/:path*",
  "/participant-claim/:path*",
  "/mtc-anonym/:path*",
  "/sportlerboerse",
  "/sportlerboerse/:path*",
  "/sportlerboerse-dashboard",
  "/nachrichten",
  "/profile",
  "/admin/:path*",
  "/zeitnahme/:path*",
  "/api/results",
  "/api/teams",
  "/api/teams/:path*",
  "/api/participants/:path*",
  "/api/claim/:path*",
  "/api/participant-claim/:path*",
  "/api/mtc-anonym/:path*",
  "/api/admin/:path*",
  "/api/messages/:path*",
  "/api/profile/:path*",
  "/api/privacy/:path*",
  "/api/timekeeping/:path*",
];

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
          },
        ],
      },
      ...sensitiveRoutePatterns.map((source) => ({
        source,
        headers: [noIndexHeader],
      })),
    ];
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "header",
            key: "host",
            value: "s5-evo-portal.vercel.app",
          },
        ],
        destination: "https://portal.s5evo.de/:path*",
        permanent: true,
      },
    ];
  },
  ...(isStaticExport
    ? {
        output: "export",
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
