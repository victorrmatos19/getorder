'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { ProdutoGrupo } from '@/types'

// Vínculos (produtos_grupos) de um produto, com o grupo (e suas opções) nested.
export function useProdutoGrupos(produtoId: string | null | undefined, restauranteId: string | null | undefined) {
  const supabase = createClient()
  const qc = useQueryClient()

  const list = useQuery({
    queryKey: ['produtos-grupos', produtoId],
    enabled: !!produtoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos_grupos')
        .select('*, grupo:grupos_adicionais(*, adicionais(*))')
        .eq('produto_id', produtoId!)
        .order('ordem')
      if (error) throw error
      return (data ?? []) as ProdutoGrupo[]
    },
  })

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['produtos-grupos', produtoId] })

  // Vincula um grupo ao produto. ignoreDuplicates respeita unique(produto_id, grupo_id).
  const vincular = useMutation({
    mutationFn: async (input: { grupoId: string; ordem: number }) => {
      if (!produtoId) throw new Error('Produto não definido')
      if (!restauranteId) throw new Error('Restaurante não definido')
      const { error } = await supabase
        .from('produtos_grupos')
        .upsert(
          {
            restaurante_id: restauranteId,
            produto_id: produtoId,
            grupo_id: input.grupoId,
            ordem: input.ordem,
          },
          { onConflict: 'produto_id,grupo_id', ignoreDuplicates: true },
        )
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const desvincular = useMutation({
    mutationFn: async (grupoId: string) => {
      if (!produtoId) throw new Error('Produto não definido')
      const { error } = await supabase
        .from('produtos_grupos')
        .delete()
        .eq('produto_id', produtoId)
        .eq('grupo_id', grupoId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const setOrdem = useMutation({
    mutationFn: async (input: { grupoId: string; ordem: number }) => {
      if (!produtoId) throw new Error('Produto não definido')
      const { error } = await supabase
        .from('produtos_grupos')
        .update({ ordem: input.ordem })
        .eq('produto_id', produtoId)
        .eq('grupo_id', input.grupoId)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { ...list, vincular, desvincular, setOrdem }
}
