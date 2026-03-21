import NextAuth from "next-auth";
import type { NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: "authentik",
      name: "Authentik",
      type: "oauth",
      wellKnown: `${process.env.AUTHENTIK_ISSUER}/.well-known/openid-configuration`,
      clientId: process.env.AUTHENTIK_CLIENT_ID,
      clientSecret: process.env.AUTHENTIK_CLIENT_SECRET,
      authorization: { params: { scope: "openid profile email" } },
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
      if (account) {
        token.accessToken = account.access_token;
        token.id = profile?.sub;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
