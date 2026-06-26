import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Validação do caller para os Route Handlers de /api/admin/* (server-only).
// Centraliza a checagem: autenticado + role=admin + ativo, e DERIVA o
// restaurante_id do perfil no servidor — nunca aceito do client. É o pilar
// anti-forja de tenant: o admin só opera dentro do próprio restaurante.
//
// Aceita DUAS formas de sessão (sem quebrar nenhuma):
//   • Cookie (navegador / app web) — fluxo original, via createServerClient.
//   • Authorization: Bearer <access_token> (app nativo) — valida o JWT com
//     supabase.auth.getUser(token). Num request Bearer-only NÃO há cookie, então
//     o PostgREST não recebe o token e a RLS veria auth.uid() nulo; por isso o
//     perfil é lido via service_role (identidade já validada por getUser(token)).
//
// Uso:
//   const auth = await requireAdmin(req)   // req opcional (Bearer); sem ele, cookie
//   if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
//   // auth.userId, auth.restauranteId disponíveis

export type RequireAdminResult =
  | { ok: true; userId: string; restauranteId: string }
  | { ok: false; status: number; error: string }

function extrairBearer(req?: Request): string | null {
  const authz = req?.headers.get('authorization')
  if (!authz) return null
  const m = /^bearer\s+(.+)$/i.exec(authz.trim())
  return m ? m[1].trim() || null : null
}

export async function requireAdmin(req?: Request): Promise<RequireAdminResult> {
  const bearer = extrairBearer(req)
  const supabase = await createServerClient()

  const { data: { user } } = bearer
    ? await supabase.auth.getUser(bearer)
    : await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: 'Não autenticado' }

  // Leitura do perfil: com Bearer (request sem cookie), usa service_role —
  // a identidade já foi validada acima e filtramos pelo próprio user.id. Sem
  // Bearer, mantém o client de cookie (RLS lê o próprio perfil), como antes.
  let perfil: { role: string | null; restaurante_id: string | null; ativo: boolean | null } | null = null
  if (bearer) {
    let admin
    try {
      admin = createAdminClient()
    } catch {
      return {
        ok: false,
        status: 500,
        error: 'Configuração do servidor incompleta: SUPABASE_SERVICE_ROLE_KEY ausente no ambiente.',
      }
    }
    const { data } = await admin
      .from('perfis')
      .select('role, restaurante_id, ativo')
      .eq('id', user.id)
      .maybeSingle()
    perfil = data
  } else {
    const { data } = await supabase
      .from('perfis')
      .select('role, restaurante_id, ativo')
      .eq('id', user.id)
      .maybeSingle()
    perfil = data
  }

  if (perfil?.role !== 'admin') {
    return { ok: false, status: 403, error: 'Apenas o admin do restaurante' }
  }
  if (perfil.ativo === false) {
    return { ok: false, status: 403, error: 'Conta desativada' }
  }
  if (!perfil.restaurante_id) {
    return { ok: false, status: 403, error: 'Admin sem restaurante associado' }
  }

  return { ok: true, userId: user.id, restauranteId: perfil.restaurante_id }
}
