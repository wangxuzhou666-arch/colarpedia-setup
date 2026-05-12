// next-auth v5 root config. Imported by:
//   - app/api/auth/[...nextauth]/route.js  (handlers)
//   - app/api/deploy/route.js              (auth() to read user's session)
//   - server-side anywhere we need the GitHub access token.

import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

// Fail-fast on missing secrets at module load time. Without AUTH_SECRET,
// next-auth would silently derive a token-signing key, meaning JWTs
// could be forged across deploys. Without the GitHub client id/secret
// the OAuth flow returns an unhelpful error mid-redirect. Better to
// crash the process at boot so misconfiguration is obvious.
for (const key of ["AUTH_SECRET", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"]) {
  if (!process.env[key]) {
    throw new Error(
      `[auth] Missing required env var ${key}. ` +
        (key === "AUTH_SECRET"
          ? "Generate one with: openssl rand -base64 32"
          : "Register a GitHub OAuth App at github.com/settings/developers.")
    );
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      // public_repo: minimum scope to fork the template + commit
      // wiki content into a *public* repo on the user's account.
      // Workplay is a public-personal-wiki tool by design — we
      // intentionally don't ask for the broader `repo` scope so
      // the user can't accidentally grant us access to their
      // private repos.
      authorization: { params: { scope: "public_repo read:user user:email" } },
    }),
  ],
  callbacks: {
    // Stash the access_token in the JWT so server routes can call
    // GitHub on the user's behalf.
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      if (profile) {
        token.githubLogin = profile.login;
      }
      return token;
    },
    // Expose what the client UI needs (login name + auth flag).
    // Server routes use getToken(req) directly to read the raw
    // access_token without round-tripping it through the client.
    async session({ session, token }) {
      if (session.user) {
        session.user.githubLogin = token.githubLogin;
      }
      return session;
    },
  },
  pages: {
    // No custom login page — next-auth's default redirects to
    // GitHub's OAuth screen which is what we want.
  },
});