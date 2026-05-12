'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Produto } from '@/types'

export function useProdutos(
  restauranteId: string | null | undefined,
  opts: { soDisponiveis?: boolean } = {},
) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['produtos', restauranteId, opts.soDisponiveis ?? false],
    enabled: !!restauranteId,
    queryFn: async () => {
      let q = supabase
        .from('produtos')
        .select('*, categoria_ref:categorias(*)')
        .eq('restaurante_id', restauranteId!)
        .order('destaque_ordem', { ascending: true })
        .order('ordem', { ascending: true })
        .order('nome', { ascending: true })
      if (opts.soDisponiveis) q = q.eq('disponivel', true)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Produto[]
    },
  })
}
