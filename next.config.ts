import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.api-sports.io" },
    ],
  },
};

export default nextConfig;
