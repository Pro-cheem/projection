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
  
  // External packages allowed on the server runtime (Next 15)
  serverExternalPackages: ['@prisma/client', 'bcrypt'],
  
  // Webpack configuration
  webpack: (config) => {
    // Next.js handles static assets natively; no custom file-loader needed
    return config;
  },
  
  // Build configuration
  generateBuildId: async () => 'build-' + Date.now(),
  
  // Experimental features
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcrypt'],
  },
};

// Only require keys in production
if (process.env.NODE_ENV === 'production' && !process.env.OPENWEATHER_API_KEY) {
  console.warn('⚠️  Warning: OPENWEATHER_API_KEY is not set in production environment');
}

module.exports = nextConfig;
