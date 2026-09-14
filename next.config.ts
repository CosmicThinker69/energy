import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  experimental: { authInterrupts: true },
};
export default config;
