/** @type {import('next').NextConfig} */
const nextConfig = {
  // SSR mode — required because /api routes call the Anthropic SDK
  // and (Phase 1C) GitHub OAuth, neither of which can run on a static
  // export. The colarpedia-template repo is the static one — this
  // colarpedia-setup tool is the Next.js server that drives it.
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;