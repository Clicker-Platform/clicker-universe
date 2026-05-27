/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    // firebase-admin di serverExternalPackages — tidak di-bundle Turbopack/webpack.
    serverExternalPackages: [
      'firebase-admin',
      'sharp',
      '@react-pdf/renderer',
      '@google-cloud/secret-manager',
      '@grpc/grpc-js',
      'google-gax',
      'isomorphic-dompurify',
      'jsdom',
    ],
    allowedDevOrigins: ['192.168.0.100'],
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
