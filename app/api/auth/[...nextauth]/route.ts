import NextAuth from "next-auth";
import type { NextAuthOptions } from "next-auth";
import {
  readAuthentikClientId,
  readAuthentikClientSecret,
  resolveAuthentikIssuer,
} from "@/lib/authentik-config";

const AUTHENTIK_ISSUER = resolveAuthentikIssuer(process.env.AUTHENTIK_ISSUER);
const AUTHENTIK_CLIENT_ID = readAuthentikClientId();
const AUTHENTIK_CLIENT_SECRET = readAuthentikClientSecret();
const AUTH_LOG_PREFIX = "[auth]";
const SENSITIVE_AUTH_KEY_PATTERN = /token|secret|password|assertion|cookie|session|authorization|clientsecret|access_token|refresh_token|id_token|code/i;

type AuthLogger = {
  error(code: string, ...message: unknown[]): void;
  warn(code: string, ...message: unknown[]): void;
  debug(code: string, ...message: unknown[]): void;
};

type AuthentikProfile = {
  sub?: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  picture?: string;
};

function redactAuthUrl(rawValue: string) {
  try {
    const url = new URL(rawValue);
    for (const key of Array.from(url.searchParams.keys())) {
      if (SENSITIVE_AUTH_KEY_PATTERN.test(key)) {
        url.searchParams.set(key, "[redacted]");
      }
    }
    return url.toString();
  } catch {
    return rawValue;
  }
}

function sanitizeAuthLogValue(value: unknown, key?: string): unknown {
  if (value == null) {
    return value;
  }

  if (typeof value === "string") {
    if (key && SENSITIVE_AUTH_KEY_PATTERN.test(key)) {
      return "[redacted]";
    }

    if (value.startsWith("http://") || value.startsWith("https://")) {
      return redactAuthUrl(value);
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuthLogValue(item, key));
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeAuthLogValue(entryValue, entryKey),
      ]),
    );
  }

  return value;
}

function logAuth(level: "error" | "warn" | "info", code: string, details: unknown[]) {
  const payload = details.length === 1 ? details[0] : details;
  console[level](AUTH_LOG_PREFIX, code, sanitizeAuthLogValue(payload));
}

const authLogger: AuthLogger = {
  error(code, ...message) {
    logAuth("error", code, message);
  },
  warn(code, ...message) {
    logAuth("warn", code, message);
  },
  debug(code, ...message) {
    if (process.env.NODE_ENV !== "production") {
      logAuth("info", code, message);
    }
  },
};

export const authOptions: NextAuthOptions = {
  logger: authLogger,
  session: {
    strategy: "jwt",
  },
  providers: [
    {
      id: "authentik",
      name: "Authentik",
      type: "oauth",
      wellKnown: `${AUTHENTIK_ISSUER}/.well-known/openid-configuration`,
      clientId: AUTHENTIK_CLIENT_ID,
      clientSecret: AUTHENTIK_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "openid profile email",
        }
      },
      idToken: true,
      checks: ["pkce", "state"],
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name ?? profile.preferred_username,
          email: profile.email,
          image: profile.picture,
        };
      },
    },
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      console.info(AUTH_LOG_PREFIX, "SIGNIN_ALLOWED", sanitizeAuthLogValue({
        provider: account?.provider,
        providerAccountId: account?.providerAccountId,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        profile,
      }));
      return true;
    },
    async jwt({ token, account, profile, trigger, session }) {
      // Keep the session token lean so the auth cookie stays below browser limits.
      if (account) {
        const authentikProfile = profile as AuthentikProfile | undefined;
        token.id = authentikProfile?.sub;
        token.email = authentikProfile?.email;
        token.name = authentikProfile?.name ?? authentikProfile?.preferred_username;
        token.picture = authentikProfile?.picture;
        token.idToken = account.id_token;
      }
      if (trigger === "update") {
        const updatedName =
          typeof session?.name === "string"
            ? session.name.trim()
            : typeof session?.user?.name === "string"
              ? session.user.name.trim()
              : "";
        if (updatedName) {
          token.name = updatedName;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id =
          typeof token.id === "string" ? token.id : undefined;
        if (typeof token.email === "string") {
          session.user.email = token.email;
        }
        if (typeof token.name === "string") {
          session.user.name = token.name;
        }
        if (typeof token.picture === "string") {
          session.user.image = token.picture;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  events: {
    async signIn(message) {
      console.info(AUTH_LOG_PREFIX, "SIGNIN_EVENT", sanitizeAuthLogValue(message));
    },
    // When signing out, redirect to Authentik logout to clear SSO session
    async signOut() {
      // Client-side signOut handles the redirect via the component
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
