/** @type {import('next').NextConfig} */
const nextConfig = {
  // Leaflet uses browser APIs; ensure it's not SSR-loaded
  // The map component is imported with { ssr: false } — this just documents that intent.
  webpack: (config) => {
    // Leaflet relies on 'self' which is not defined in Node. This alias prevents
    // the SSR bundle from attempting to import it.
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    return config;
  },
};

module.exports = nextConfig;
