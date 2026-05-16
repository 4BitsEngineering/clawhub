import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hay un lockfile heredado en C:\Users\Nitropc — fijamos root al de clawhub.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
