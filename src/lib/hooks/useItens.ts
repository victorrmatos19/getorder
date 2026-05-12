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
        .select('*, produto:produtos(*)')
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
        .select('*, produto:produtos(*), comanda:comandas(*, mesa:mesas(*))')
        .in('status', ['novo', 'em_preparo', 'pronto'])
        .order('criado_em', { ascending: true })
      if (error) throw error
      return (data ?? []) as ItemPedido[]
    },
  })
}
