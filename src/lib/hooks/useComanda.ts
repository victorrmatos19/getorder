'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Comanda } from '@/types'

export function useComanda(id: string | undefined) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['comanda', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comandas')
        .select('*, mesa:mesas(*)')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data as (Comanda & { mesa?: any }) | null
    },
  })
}

export function useComandasAbertas(restauranteId: string | null | undefined) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['comandas-abertas', restauranteId],
    enabled: !!restauranteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comandas')
        .select('*, mesa:mesas(*)')
        .eq('restaurante_id', restauranteId!)
        .eq('status', 'aberta')
        .order('criado_em', { ascending: true })
      if (error) throw error
      return (data ?? []) as Comanda[]
    },
  })
}
