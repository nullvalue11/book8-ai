const path = require("path");

/** Single origin for global response headers (per-route handlers use cors-allow for reflection). */
function defaultCorsOrigin() {
  const raw = process.env.CORS_ORIGINS;
  if (raw && String(raw).trim()) {
    const first = String(raw).split(",")[0].trim();
    if (first) return first;
  }
  return "https://www.book8.io";
}

const nextConfig = {
  // output: 'standalone', // Disabled for Vercel - causes routing issues
  images: { unoptimized: true },
  serverExternalPackages: ['mongodb'],
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
  async rewrites() {
    return [
      // Ensure NextAuth catch-all routes are properly handled
      {
        source: '/api/auth/:path*',
        destination: '/api/auth/:path*',
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/brand/:all*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ],
      },
      {
        // Disable caching for auth routes to prevent stale 404s
        source: "/api/auth/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
      { source: "/(.*)", headers: [
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'self';" },
        { key: "Access-Control-Allow-Origin", value: defaultCorsOrigin() },
        { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
        { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Requested-With, X-Book8-Internal-Secret" },
      ]} ,
    ];
  },
};

module.exports = nextConfig;
