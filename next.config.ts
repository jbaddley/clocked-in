import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const deploymentId = process.env.VERCEL_DEPLOYMENT_ID;

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.localhost"],
  devIndicators: false,
  // A new deployment id busts asset URLs and turns a skewed client navigation
  // into a full page load on the first click.
  ...(deploymentId ? { deploymentId } : {}),
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    appNavFailHandling: true,
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
