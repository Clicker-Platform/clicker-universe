import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
