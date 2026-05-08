"use client";

// SessionProvider wrapper — required for useSession() in client
// components anywhere under <Providers>.

import { SessionProvider } from "next-auth/react";

export function Providers({ children }) {
  return <SessionProvider>{children}</SessionProvider>;
}