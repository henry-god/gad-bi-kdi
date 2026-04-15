/** @type {import('next').NextConfig} */
const nextConfig = {
  // Khmer font optimization
  optimizeFonts: true,
  
  // API proxy to backend.
  // - Local dev: forward /api/* to Express on :4000.
  // - Production: /api/auth/public-config is served by a Next.js route
  //   handler (src/app/api/auth/public-config/route.ts); the rest of
  //   /api/* will 404 in prod until the Express backend is deployed to
  //   Cloud Run (next session).
  async rewrites() {
    if (process.env.NODE_ENV !== 'production') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:4000/api/:path*',
        },
      ];
    }
    return [];
  },

  // Allow Khmer Unicode in static content
  webpack: (config) => {
    config.module.rules.push({
      test: /\.json$/,
      type: 'json',
    });
    return config;
  },
};

module.exports = nextConfig;
