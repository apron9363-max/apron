/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  // Long-lived immutable caching for favicon assets (brand logo derivatives).
  async headers() {
    return [
      {
        source:
          "/(favicon.ico|favicon.svg|favicon-16.png|favicon-32.png|favicon-48.png|apple-touch-icon.png|icon-512.png)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.cache = { type: "memory" };
    }
    return config;
  },
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
