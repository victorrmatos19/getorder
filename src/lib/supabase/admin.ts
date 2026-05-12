import { createClient } from '@supabase/supabase-js'

// Cliente Supabase com a SERVICE_ROLE_KEY. SOMENTE em rotas server-side.
// Nunca importar a partir de componentes client.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente. Configure em .env.local.')
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
