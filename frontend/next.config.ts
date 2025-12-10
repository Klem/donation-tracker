import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    turbopack: {
        root: __dirname, // force le root ici
    },
    // Exclut les packages avec worker threads du bundling Turbopack
    serverExternalPackages: [
        'pino',
        'pino-pretty',
        'thread-stream',
        'pino-worker',
        'real-require',
        'sonic-boom',
    ],

    // Exclut les fichiers de test du bundle
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.resolve.alias = {
                ...config.resolve.alias,
                // Empêche l'import des tests côté client
                'thread-stream/test': false,
            };
        }

        // Exclut complètement les fichiers de test
        config.module = {
            ...config.module,
            exprContextCritical: false,
        };

        return config;
    },
};

export default nextConfig;
