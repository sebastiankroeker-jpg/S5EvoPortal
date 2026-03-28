import NextAuth from "next-auth";
import type { NextAuthOptions } from "next-auth";

const AUTHENTIK_ISSUER = process.env.AUTHENTIK_ISSUER || "";

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: "authentik",
      name: "Authentik",
      type: "oauth",
      wellKnown: `${AUTHENTIK_ISSUER}/.well-known/openid-configuration`,
      clientId: process.env.AUTHENTIK_CLIENT_ID,
      clientSecret: process.env.AUTHENTIK_CLIENT_SECRET,
      authorization: { 
        params: { 
          scope: "openid profile email",
          // Force re-authentication prompt so switching accounts works
          prompt: "login",
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
      // Always update token when a new login happens
      if (account) {
        token.accessToken = account.access_token;
        token.id = profile?.sub;
        token.email = profile?.email;
        token.name = profile?.name ?? (profile as any)?.preferred_username;
        token.picture = (profile as any)?.picture;
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
