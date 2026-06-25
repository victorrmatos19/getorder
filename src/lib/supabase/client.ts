import { createBrowserClient } from '@supabase/ssr'

// opts.noStore: força `cache: 'no-store'` em toda requisição deste client.
// Usado SÓ na leitura pública da mesa (/mesa/[id]) para nunca servir uma resposta
// cacheada (navegador/CDN/webview do WhatsApp) — ex.: um "vazio" de antes da mesa
// existir mascarando a mesa logo após criada. O resto do app segue com o cache
// padrão (e o TanStack Query cuida do cache de dados em memória).
export function createClient(opts?: { noStore?: boolean }) {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    opts?.noStore
      ? {
          global: {
            fetch: (input: RequestInfo | URL, init?: RequestInit) =>
              fetch(input, { ...init, cache: 'no-store' }),
          },
        }
      : undefined,
  )
}
