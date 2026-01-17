const path = require("path");

const nextConfig = {
  // output: 'standalone', // Disabled for Vercel - causes routing issues
  images: { unoptimized: true },
  experimental: { serverComponentsExternalPackages: ['mongodb'] },
  webpack(config, { dev }) {
    // Aliases for CI safety
    config.resolve.alias["@"] = path.resolve(__dirname, "app");
    config.resolve.alias["@app"] = path.resolve(__dirname, "app"); // legacy compat
    config.resolve.alias["@/components"] = path.resolve(__dirname, "app/components");
    config.resolve.alias["@/lib"] = path.resolve(__dirname, "app/lib");

    if (dev) {
      config.watchOptions = { poll: 2000, aggregateTimeout: 300, ignored: ['**/node_modules'] };
    }
    return config;
  },
  onDemandEntries: { maxInactiveAge: 10000, pagesBufferLength: 2 },
  async headers() {
    return [
      {
        source: "/brand/:all*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ],
      },
      { source: "/(.*)", headers: [
        { key: "X-Frame-Options", value: "ALLOWALL" },
        { key: "Content-Security-Policy", value: "frame-ancestors *;" },
        { key: "Access-Control-Allow-Origin", value: process.env.CORS_ORIGINS || "*" },
        { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
        { key: "Access-Control-Allow-Headers", value: "*" },
      ]} ,
    ];
  },
};

module.exports = nextConfig;
