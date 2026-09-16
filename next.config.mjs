import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: projectRoot,
  distDir: process.env.NEXT_DIST_DIR === ".next-local" ? ".next-local" : ".next",
  webpack(config, { dev }) {
    if (dev && process.env.NEXT_DIST_DIR === ".next-local") {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: /[\\/](?:\.next(?:-local)?|\.git|node_modules)(?:[\\/]|$)/,
      };
    }
    return config;
  },
};
export default nextConfig;
