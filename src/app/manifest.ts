import type { MetadataRoute } from 'next'

// Manifesto PWA (API nativa do App Router) → /manifest.webmanifest.
// Instalabilidade é por ORIGEM; o convite visível fica restrito ao staff via UI (InstallPrompt),
// não pelo manifesto. start_url = /login (entrada do staff), NÃO o fluxo do cliente.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GetOrder',
    short_name: 'GetOrder',
    description: 'Operação do restaurante — cozinha, garçom e administração.',
    start_url: '/login',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'pt-BR',
    background_color: '#FAF9F5', // --bg
    theme_color: '#4A5240', // --primary (verde oliva)
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
