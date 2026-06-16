'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { GrupoAdicional } from '@/types'

/**
 * Grupos vinculados a um produto, prontos para o cliente:
 * só grupos ativos, só opções disponíveis, ordenados por produtos_grupos.ordem
 * (e as opções por adicionais.ordem). Leitura pública (RLS public_read_*).
 */
export function useProdutoOpcoes(produtoId: string | null | undefined) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['produto-opcoes', produtoId],
    enabled: !!produtoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos_grupos')
        .select('ordem, grupo:grupos_adicionais(*, adicionais(*))')
        .eq('produto_id', produtoId!)
        .order('ordem')
      if (error) throw error

      const grupos: GrupoAdicional[] = []
      for (const row of (data ?? []) as any[]) {
        const g = row.grupo
        if (!g || !g.ativo) continue
        const adicionais = (g.adicionais ?? [])
          .filter((a: any) => a.disponivel)
          .sort((a: any, b: any) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))
        grupos.push({ ...g, adicionais } as GrupoAdicional)
      }
      return grupos
    },
  })
}

/**
 * Conjunto de produto_ids que têm ao menos um grupo ATIVO vinculado.
 * Usado no cardápio para decidir entre fluxo rápido x tela de detalhe.
 */
export function useProdutosComGrupos(restauranteId: string | null | undefined) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['produtos-com-grupos', restauranteId],
    enabled: !!restauranteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos_grupos')
        .select('produto_id, grupo:grupos_adicionais(ativo)')
        .eq('restaurante_id', restauranteId!)
      if (error) throw error
      const set = new Set<string>()
      for (const row of (data ?? []) as any[]) {
        if (row.grupo?.ativo) set.add(row.produto_id)
      }
      return set
    },
  })
}
