import type { NextConfig } from "next";

// The browser only ever talks to :3000; /api/* is proxied to the Go API so the
// session cookie stays first-party and no CORS is needed.
const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
