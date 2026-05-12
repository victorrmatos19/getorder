'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Categoria } from '@/types'

export function useCategorias(restauranteId: string | null | undefined, opts: { soAtivas?: boolean } = {}) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['categorias', restauranteId, opts.soAtivas ?? false],
    enabled: !!restauranteId,
    queryFn: async () => {
      let q = supabase
        .from('categorias')
        .select('*')
        .eq('restaurante_id', restauranteId!)
        .order('ordem')
        .order('nome')
      if (opts.soAtivas) q = q.eq('ativa', true)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Categoria[]
    },
  })
}
