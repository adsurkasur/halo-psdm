import type { NextConfig } from "next";
import { BASE_PATH } from "./src/lib/base-path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Multi-Zones: empty by default (standalone). See src/lib/base-path.ts.
  basePath: BASE_PATH || undefined,
};

export default nextConfig;