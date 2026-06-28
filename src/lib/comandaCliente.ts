import { createClient } from '@/lib/supabase/client'
import type { ItemPedido } from '@/types'

/**
 * Fluxo do cliente anônimo (/mesa) — agora 100% via RPC SECURITY DEFINER.
 *
 * Por segurança (Discovery Cyber #1/#2), o cliente NÃO lê comandas/itens direto:
 *  - a leitura de VENDAS na RLS é escopada só a staff do tenant;
 *  - o cliente abre/lê/cancela apenas a PRÓPRIA comanda por estas funções.
 */

export type ComandaCliente = {
  id: string
  status: string
  cliente_nome: string | null
  conta_solicitada_em: string | null
  itens: ItemPedido[]
}

/** find-or-create da comanda aberta da mesa (reusa a comanda — não cria a cada load). */
export async function abrirComandaMesa(mesaId: string): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('abrir_comanda_mesa', { p_mesa_id: mesaId })
  if (error) throw error
  return data as string
}

/** lê SOMENTE a comanda informada (id + itens + adicionais). null se não existir. */
export async function getComandaCliente(comandaId: string): Promise<ComandaCliente | null> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_comanda_cliente', { p_comanda_id: comandaId })
  if (error) throw error
  return (data as ComandaCliente | null) ?? null
}

/** cancela um item 'novo' da própria comanda (guard de race no servidor). */
export async function cancelarItemCliente(comandaId: string, itemId: string): Promise<boolean> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('cancelar_item_cliente', {
    p_comanda_id: comandaId,
    p_item_id: itemId,
  })
  if (error) throw error
  return data as boolean
}

/** sinaliza "quero a conta" na própria comanda aberta (guard de status no servidor). */
export async function solicitarConta(comandaId: string): Promise<boolean> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('solicitar_conta', { p_comanda_id: comandaId })
  if (error) throw error
  return data as boolean
}
