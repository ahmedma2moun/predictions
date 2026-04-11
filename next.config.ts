import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: { dynamic: 0 },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.api-sports.io" },
      { protocol: "https", hostname: "crests.football-data.org" },
    ],
  },
};

export default nextConfig;
