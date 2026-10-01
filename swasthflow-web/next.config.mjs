/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { dev }) => {
    // OneDrive locks files during rename, corrupting the webpack persistent
    // cache and causing CSS chunks to 404 in dev. Use in-memory cache instead.
    if (dev) {
      config.cache = { type: "memory" };
    }
    return config;
  },
};

export default nextConfig;
