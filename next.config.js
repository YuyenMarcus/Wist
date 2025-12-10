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
  // Exclude separate services from webpack compilation
  webpack: (config, { isServer }) => {
    // Ignore Wist-scraper-service and other separate services
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^\.\/Wist-scraper-service/,
        contextRegExp: /\.$/,
      })
    );
    
    // Also exclude from module resolution
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    
    return config;
  },
}

module.exports = nextConfig
