import type { NextConfig } from "next";

// Set BASE_PATH when serving from a sub-path, e.g. "/PostReview" for a GitHub Pages project site.
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
