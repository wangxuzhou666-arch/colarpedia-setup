"use client";

import { useEffect } from "react";

export default function RootRedirect() {
  useEffect(() => {
    window.location.replace("/yourpedia/");
  }, []);
  return (
    <div style={{ fontFamily: "Georgia, serif", padding: 24 }}>
      <p>
        正在跳转到 <a href="/yourpedia/">/yourpedia/</a>…
      </p>
    </div>
  );
}
