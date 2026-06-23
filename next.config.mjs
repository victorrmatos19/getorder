import withSerwistInit from '@serwist/next'

// PWA (staff): gera o service worker a partir de src/app/sw.ts.
// Desabilitado em DEV de propósito — evita o SW servir build antigo enquanto se desenvolve.
const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})

// Headers de segurança (Discovery Cyber #7). CSP propositalmente só com `frame-ancestors`
// (clickjacking) para não quebrar os estilos/scripts inline do Next; o resto é hardening padrão.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
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
