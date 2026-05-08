/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  // NOTE: output:'export' does not support redirects(); the root redirect
  // to the homepage slug is handled client-side in app/page.jsx.
};

export default nextConfig;
