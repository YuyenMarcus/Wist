const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Important: Playwright needs to run in Node.js runtime
  // This config ensures API routes use Node.js
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Output configuration for standalone deployment (helps with Docker)
  output: 'standalone',
  // CORS Headers for Chrome Extension
  async headers() {
    return [
      {
        // Allow the Extension to talk to the API
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
  // Exclude separate services from webpack compilation
  webpack: (config, { isServer }) => {
    // Ignore Wist-scraper-service and other separate services
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^\.\/Wist-scraper-service/,
        contextRegExp: /\.$/,
      })
    );
    
    // Exclude server-only dependencies from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      };
      
      // Ignore native modules and server-only packages in client bundle
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^(playwright|playwright-extra|playwright-extra-plugin-stealth|re2)$/,
        })
      );
    }
    
    // Exclude .node files (native modules) from webpack processing
    // These are binary files that should only be loaded at runtime
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];
    
    // Add rule to ignore .node files
    const existingRules = config.module.rules.filter(
      rule => rule && rule.test && rule.test.toString().includes('.node')
    );
    
    if (existingRules.length === 0) {
      config.module.rules.push({
        test: /\.node$/,
        use: 'ignore-loader',
      });
    }
    
    // Also exclude from module resolution
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    
    return config;
  },
}

module.exports = nextConfig
