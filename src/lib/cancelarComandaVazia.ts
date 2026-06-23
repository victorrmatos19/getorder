import { createClient } from '@/lib/supabase/client'

// Cancela uma comanda VAZIA (sem itens) do próprio restaurante. A RPC
// (SECURITY DEFINER) valida tenant + status 'aberta' + ausência de itens;
// recusa com erro claro se a comanda tiver itens ou já estiver fechada.
export async function cancelarComandaVazia(comandaId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc('cancelar_comanda_vazia', { p_comanda_id: comandaId })
  if (error) throw error
}
