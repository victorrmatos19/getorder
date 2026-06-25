import { createClient as createServerClient } from '@/lib/supabase/server'

// Validação do caller para os Route Handlers de /api/admin/* (server-only).
// Centraliza a checagem: autenticado + role=admin + ativo, e DERIVA o
// restaurante_id do perfil no servidor — nunca aceito do client. É o pilar
// anti-forja de tenant: o admin só opera dentro do próprio restaurante.
//
// Uso:
//   const auth = await requireAdmin()
//   if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
//   // auth.userId, auth.restauranteId disponíveis

export type RequireAdminResult =
  | { ok: true; userId: string; restauranteId: string }
  | { ok: false; status: number; error: string }

export async function requireAdmin(): Promise<RequireAdminResult> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: 'Não autenticado' }

  const { data: perfil } = await supabase
    .from('perfis')
    .select('role, restaurante_id, ativo')
    .eq('id', user.id)
    .maybeSingle()

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
