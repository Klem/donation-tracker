import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    turbopack: {
        root: __dirname, // force le root ici
    },
};

export default nextConfig;
