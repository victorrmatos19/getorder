'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { ItemPedido } from '@/types'

export function useItensComanda(comandaId: string | undefined) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['itens', 'comanda', comandaId],
    enabled: !!comandaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('itens_pedido')
        .select('*, produto:produtos(*), adicionais:itens_pedido_adicionais(*)')
        .eq('comanda_id', comandaId!)
        .order('criado_em', { ascending: true })
      if (error) throw error
      return (data ?? []) as ItemPedido[]
    },
  })
}

export function useItensCozinha() {
  const supabase = createClient()
  return useQuery({
    queryKey: ['itens', 'cozinha'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('itens_pedido')
        .select('id, comanda_id, produto_id, quantidade, obs, status, criado_em, produto:produtos(nome), comanda:comandas(cliente_nome, mesa:mesas(nome)), adicionais:itens_pedido_adicionais(*)')
        .in('status', ['novo', 'em_preparo', 'pronto'])
        .order('criado_em', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as ItemPedido[]
    },
  })
}
