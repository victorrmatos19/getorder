'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Categoria } from '@/types'

export function useCategoriasAdmin(restauranteId: string | null | undefined) {
  const supabase = createClient()
  const qc = useQueryClient()

  const list = useQuery({
    queryKey: ['categorias-admin', restauranteId],
    enabled: !!restauranteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('restaurante_id', restauranteId!)
        .order('ordem')
        .order('nome')
      if (error) throw error
      return (data ?? []) as Categoria[]
    },
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['categorias-admin', restauranteId] })
    qc.invalidateQueries({ queryKey: ['categorias', restauranteId] })
  }

  const upsert = useMutation({
    mutationFn: async (input: { id?: string; nome: string; emoji: string | null; ordem: number; ativa: boolean }) => {
      if (!restauranteId) throw new Error('Restaurante não definido')
      if (input.id) {
        const { error } = await supabase
          .from('categorias')
          .update({ nome: input.nome, emoji: input.emoji, ordem: input.ordem, ativa: input.ativa })
          .eq('id', input.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('categorias')
          .insert({
            restaurante_id: restauranteId,
            nome: input.nome,
            emoji: input.emoji,
            ordem: input.ordem,
            ativa: input.ativa,
          })
        if (error) throw error
      }
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categorias').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { ...list, upsert, remove }
}
