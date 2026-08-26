import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Deployment pins the Node runtime and the iad1 region at the platform level,
  // not here: the database lives in one region and spreading compute across the
  // globe only adds round trips to it. Route handlers stay on Node because the
  // Edge runtime cannot open the WebSocket that neon-serverless needs.
  serverExternalPackages: ['@neondatabase/serverless'],
};

export default nextConfig;
