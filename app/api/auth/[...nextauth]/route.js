// Re-export the auth handlers next-auth v5 generated in /auth.js.
// Handles every leg of the OAuth dance:
//   /api/auth/signin             (start OAuth flow)
//   /api/auth/callback/github    (GitHub redirects here after user grants)
//   /api/auth/signout
//   /api/auth/session            (client polls this to read session)

import { handlers } from "@/auth";
export const { GET, POST } = handlers;