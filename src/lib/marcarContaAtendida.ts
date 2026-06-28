import { createClient } from '@/lib/supabase/client'

// Limpa o sinal "conta pedida" da comanda (garçom/admin atendeu). A RPC
// (SECURITY DEFINER) valida tenant + status 'aberta'; é idempotente (no-op se já estava nulo).
export async function marcarContaAtendida(comandaId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc('marcar_conta_atendida', { p_comanda_id: comandaId })
  if (error) throw error
}
