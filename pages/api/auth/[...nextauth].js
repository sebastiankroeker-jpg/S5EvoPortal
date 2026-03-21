import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export default NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "jsmith" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Minimal mock auth: accept any user with password 'password'
        if (credentials.username && credentials.password === "password") {
          return { id: 1, name: credentials.username };
        }
        return null;
      }
    })
  ],
  pages: {
    signIn: "/auth/signin"
  },
  session: {
    strategy: "jwt"
  },
  secret: "some-random-secret"
});