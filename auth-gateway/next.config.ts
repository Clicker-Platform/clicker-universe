import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['firebase-admin'],
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['192.168.0.100'],
};

export default nextConfig;
