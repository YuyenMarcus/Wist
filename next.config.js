/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  output: 'standalone',
  
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  
  // CORS Headers for Chrome Extension
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" }, 
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
        ]
      }
    ]
  },
  
  // Webpack configuration
  webpack: (config, { isServer }) => {
    // Exclude server-only dependencies from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      };
    }
    
    return config;
  },
}

module.exports = nextConfig
