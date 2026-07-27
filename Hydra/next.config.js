/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Allows production builds to succeed even if your project has type errors
    ignoreBuildErrors: true,
  },
  eslint: {
    // Allows production builds to succeed even if your project has ESLint errors
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
