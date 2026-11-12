import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: { formats: ['image/avif', 'image/webp'] },
};

export default nextConfig;

// Deja los bindings de Cloudflare (D1) disponibles durante `next dev`, contra
// una base local en .wrangler/state. Sin esto, getCloudflareContext() falla al
// desarrollar.
initOpenNextCloudflareForDev();
