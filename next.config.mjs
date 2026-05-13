/** @type {import('next').NextConfig} */
const nextConfig = {
  // SSR mode — required because /api routes call the Anthropic SDK
  // and (Phase 1C) GitHub OAuth, neither of which can run on a static
  // export. The colarpedia-template repo is the static one — this
  // colarpedia-setup tool is the Next.js server that drives it.
  trailingSlash: true,
  images: { unoptimized: true },
  async redirects() {
    return [
      // 2026-05-13 路径重命名 /setup → /yourpedia (workplay 是 platform, yourpedia 是其上的产品)。
      // 308 permanent，保留外发链接 / 老 bookmark / SEO。
      { source: "/setup", destination: "/yourpedia", permanent: true },
      { source: "/setup/:path*", destination: "/yourpedia/:path*", permanent: true },
    ];
  },
};

export default nextConfig;