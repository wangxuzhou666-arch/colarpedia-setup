"use client";

// Root simply redirects to /setup, the only route this app exposes.
import { useEffect } from "react";

export default function RootRedirect() {
  useEffect(() => {
    window.location.replace("/setup/");
  }, []);
  return (
    <div style={{ fontFamily: "Georgia, serif", padding: 24 }}>
      <p>
        Redirecting to <a href="/setup/">/setup/</a>…
      </p>
    </div>
  );
}