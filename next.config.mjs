import withSerwistInit from '@serwist/next'

// PWA (staff): gera o service worker a partir de src/app/sw.ts.
// Desabilitado em DEV de propósito — evita o SW servir build antigo enquanto se desenvolve.
const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // avif (~20% menor que webp) + webp como fallback — fotos do cardápio em rede móvel
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      // Supabase local (Docker) — fotos do cardápio em dev; inofensivo em produção
      { protocol: 'http', hostname: '127.0.0.1', port: '54321', pathname: '/storage/v1/object/public/**' },
    ],
  },
}

export default withSerwist(nextConfig)
