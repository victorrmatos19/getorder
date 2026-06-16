import { createClient } from '@/lib/supabase/client'

export type CriarItemPedidoInput = {
  comandaId: string
  produtoId: string
  quantidade: number
  observacao?: string | null
  adicionalIds?: string[]
}

/**
 * Cria um item de pedido via RPC `criar_item_pedido` (SECURITY DEFINER).
 *
 * Toda validação (tenant, comanda aberta, regras dos grupos, anti-tampering)
 * e TODO o cálculo de preço acontecem no backend. O client NUNCA envia preço —
 * apenas os IDs dos adicionais escolhidos. Retorna o id do item criado.
 */
export async function criarItemPedido({
  comandaId,
  produtoId,
  quantidade,
  observacao = null,
  adicionalIds = [],
}: CriarItemPedidoInput): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('criar_item_pedido', {
    p_comanda_id: comandaId,
    p_produto_id: produtoId,
    p_quantidade: quantidade,
    p_observacao: observacao ?? '',
    p_adicional_ids: adicionalIds ?? [],
  })
  if (error) throw error
  return data as string
}
