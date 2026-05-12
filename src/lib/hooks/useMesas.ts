'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Mesa } from '@/types'

export function useMesas(
  restauranteId: string | null | undefined,
  opts: { soAtivas?: boolean } = {},
) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['mesas', restauranteId, opts.soAtivas ?? false],
    enabled: !!restauranteId,
    queryFn: async () => {
      let q = supabase
        .from('mesas')
        .select('*')
        .eq('restaurante_id', restauranteId!)
        .order('nome')
      if (opts.soAtivas) q = q.eq('ativo', true)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Mesa[]
    },
  })
}

export function useMesa(id: string | undefined) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['mesa', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mesas')
        .select('*')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data as Mesa | null
    },
  })
}
