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
}

module.exports = nextConfig
