/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable cache
  generateEtags: false,
  
  // Disable X-Powered-By header
  poweredByHeader: false,
  
  // Enable React's strict mode
  reactStrictMode: true,
  
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    minimumCacheTTL: 60, // 1 minute
  },
  
  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // ESLint configuration
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_VERCEL_URL: process.env.VERCEL_URL,
    NEXT_PUBLIC_SITE_URL: process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000',
  },
  
  // Enable SWC minification
  swcMinify: true,
  
  // Experimental features
  experimental: {
    serverActions: true,
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
  },
  
  // Webpack configuration
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(pdf)$/,
      use: [
        {
          loader: 'file-loader',
          options: {
            publicPath: '/_next/static/files',
            outputPath: 'static/files',
            name: '[name].[ext]',
          },
        },
      ],
    });
    
    return config;
  },
  
  // Build configuration
  generateBuildId: async () => 'build-' + Date.now(),
};

// Only require keys in production
if (process.env.NODE_ENV === 'production' && !process.env.OPENWEATHER_API_KEY) {
  console.warn('⚠️  Warning: OPENWEATHER_API_KEY is not set in production environment');
}

module.exports = nextConfig;
