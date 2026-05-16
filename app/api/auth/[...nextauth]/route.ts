import NextAuth from "next-auth";
import type { NextAuthOptions } from "next-auth";

const DEFAULT_AUTHENTIK_ISSUER = "https://auth.s5evo.de/application/o/s5-evo-portal";

function unquoteEnv(rawValue?: string) {
  if (!rawValue) {
    return rawValue;
  }

  let value = rawValue.trim();
  while (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1).trim();
  }

  return value;
}

function resolveAuthentikIssuer(rawIssuer?: string) {
  const issuer = (unquoteEnv(rawIssuer) || DEFAULT_AUTHENTIK_ISSUER).replace(/\/$/, "");

  // Older setup docs accidentally used the provider slug without hyphens.
  return issuer.replace("/application/o/s5evo-portal", "/application/o/s5-evo-portal");
}

const AUTHENTIK_ISSUER = resolveAuthentikIssuer(process.env.AUTHENTIK_ISSUER);
const AUTHENTIK_CLIENT_ID = unquoteEnv(process.env.AUTHENTIK_CLIENT_ID);
const AUTHENTIK_CLIENT_SECRET = unquoteEnv(process.env.AUTHENTIK_CLIENT_SECRET);

export const authOptions: NextAuthOptions = {
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
    async jwt({ token, account, profile }) {
      // Keep the session token lean so the auth cookie stays below browser limits.
      if (account) {
        token.id = profile?.sub;
        token.email = profile?.email;
        token.name = profile?.name ?? (profile as any)?.preferred_username;
        token.picture = (profile as any)?.picture;
        token.idToken = account.id_token;
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
    // When signing out, redirect to Authentik logout to clear SSO session
    async signOut() {
      // Client-side signOut handles the redirect via the component
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
