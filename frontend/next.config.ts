import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable powered-by header
  poweredByHeader: false,
  // Fix Turbopack warning about multiple lockfiles
  turbopack: {
    root: __dirname,
  },
  // Reduce image optimization memory usage
  images: {
    minimumCacheTTL: 60,
    formats: ["image/webp"],
  },
  // Habilitar modo standalone para Docker
  output: "standalone",
};

export default nextConfig;

