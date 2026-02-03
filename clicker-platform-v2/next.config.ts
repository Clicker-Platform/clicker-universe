import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // unoptimized: true, // Optimizing images to improve performance
    // Adding domains as a fallback to remotePatterns for broader compatibility
    domains: [
      'firebasestorage.googleapis.com',
      'storage.googleapis.com',
      'images.unsplash.com',
      'picsum.photos',
      'lh3.googleusercontent.com',
      'graph.facebook.com'
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'graph.facebook.com',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      }
    ],
  },
};

export default nextConfig;
