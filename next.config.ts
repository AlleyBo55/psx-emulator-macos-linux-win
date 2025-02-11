import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  assetPrefix: isProduction ? "./" : undefined,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
