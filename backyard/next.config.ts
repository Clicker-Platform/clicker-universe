import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: false,
  serverExternalPackages: ['firebase-admin', '@google-cloud/secret-manager', '@grpc/grpc-js', 'google-gax'],
};

export default nextConfig;
