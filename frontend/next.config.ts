import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app: the repo root also carries a lockfile,
  // and the frontend deploys as its own container.
  turbopack: {
    root: __dirname,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
};

export default nextConfig;