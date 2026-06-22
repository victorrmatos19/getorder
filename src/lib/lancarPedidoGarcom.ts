import { createClient } from '@/lib/supabase/client'

export type LancarItemInput = {
  produtoId: string
  quantidade: number
  observacao?: string | null
  adicionalIds?: string[]
}

export type LancarPedidoGarcomInput = {
  comandaId?: string | null
  mesaId?: string | null
  itens: LancarItemInput[]
}

// Lança um pedido pelo garçom: find-or-create da comanda da mesa (ou usa a
// comanda informada) e cria todos os itens numa única transação no servidor.
// O frontend manda só IDs — preço/validação/snapshot são da RPC.
export async function lancarPedidoGarcom(input: LancarPedidoGarcomInput): Promise<string> {
  const supabase = createClient()
  const p_itens = input.itens.map((i) => ({
    produto_id: i.produtoId,
    quantidade: i.quantidade,
    observacao: i.observacao ?? '',
    adicionais: i.adicionalIds ?? [],
  }))
  const { data, error } = await supabase.rpc('lancar_pedido_garcom', {
    p_comanda_id: input.comandaId ?? null,
    p_mesa_id: input.mesaId ?? null,
    p_itens,
  })
  if (error) throw error
  return data as string
}
