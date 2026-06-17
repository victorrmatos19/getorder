import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist'
import { NetworkFirst, NetworkOnly, Serwist } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Lista de assets do build injetada pelo serwist no momento da geração do SW.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

// Estratégia CONSERVADORA (fase de validação — o app muda muito; nada de cache agressivo):
// - precache APENAS dos assets estáticos imutáveis do build (hash no nome) → __SW_MANIFEST.
// - navegação (HTML): NetworkFirst — sempre tenta a rede; só cai no cache se estiver offline.
// - TODO o resto, INCLUSIVE as chamadas ao Supabase (pedidos): NetworkOnly — JAMAIS vem de cache.
//   (Dados de pedido precisam ser sempre frescos; nunca podem ser servidos do SW.)
const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: ({ request }) => request.mode === 'navigate',
    handler: new NetworkFirst({ cacheName: 'pages', networkTimeoutSeconds: 10 }),
  },
  {
    matcher: () => true,
    handler: new NetworkOnly(),
  },
]

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
})

serwist.addEventListeners()
