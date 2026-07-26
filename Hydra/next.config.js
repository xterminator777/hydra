/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  productionBrowserSourceMaps: false, // Turn off map loading for node_modules
  images: {
    formats: ['image/webp'],
  },
  serverExternalPackages: [
    'livekit-server-sdk',
    '@livekit/track-processors',
    '@mediapipe/tasks-vision'
  ],
  headers: async () => {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
