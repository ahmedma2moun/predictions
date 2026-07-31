import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: { dynamic: 0 },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.api-sports.io" },
      { protocol: "https", hostname: "crests.football-data.org" },
      // TheSportsDB badges come from multiple subdomains (r2.thesportsdb.com
      // for newer CDN-hosted images, www.thesportsdb.com for legacy ones) —
      // wildcard the whole domain instead of allowlisting hosts one at a time.
      { protocol: "https", hostname: "*.thesportsdb.com" },
    ],
  },
};

export default nextConfig;
