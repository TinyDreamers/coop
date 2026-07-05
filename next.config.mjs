import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A parent-directory lockfile exists; pin file tracing to THIS project so
  // Vercel bundles the right files and the "inferred workspace root" warning stops.
  outputFileTracingRoot: __dirname,
  // three.js and its ecosystem ship ESM that Next transpiles fine, but we
  // whitelist the packages explicitly to avoid occasional resolution issues.
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  images: {
    // Uploaded reference photos are served from Vercel Blob's public CDN.
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
  },
};

export default nextConfig;
