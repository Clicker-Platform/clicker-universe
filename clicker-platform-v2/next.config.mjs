/** @type {import('next').NextConfig} */
const nextConfig = {
    serverExternalPackages: ['firebase-admin', 'sharp'],
    experimental: {
        turbo: { // or turbopack, depending on exact Next.js 14/15 version syntax, adding turbo logic to point to root 
            root: '..'
        }
    },
    images: {
        formats: ['image/avif', 'image/webp'],
        minimumCacheTTL: 2592000,
        qualities: [10, 40, 75, 85],
        remotePatterns: [
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
                hostname: 'images.unsplash.com',
            },
            {
                protocol: 'https',
                hostname: 'picsum.photos',
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
