'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { GrupoAdicional, SelecaoAdicional } from '@/types'

export type OpcaoInput = {
  id?: string          // presente = opção existente (update); ausente = nova (insert)
  nome: string
  preco: number
  disponivel: boolean
  ordem: number
}

export type SalvarGrupoInput = {
  id?: string
  nome: string
  selecao: SelecaoAdicional
  obrigatorio: boolean
  min_escolhas: number
  max_escolhas: number | null
  ativo: boolean
  opcoes: OpcaoInput[]
  opcoesRemovidas: string[]   // ids de opções existentes a excluir
}

export function useAdicionais(restauranteId: string | null | undefined) {
  const supabase = createClient()
  const qc = useQueryClient()

  const list = useQuery({
    queryKey: ['grupos-adicionais', restauranteId],
    enabled: !!restauranteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grupos_adicionais')
        .select('*, adicionais(*)')
        .eq('restaurante_id', restauranteId!)
        .order('nome')
      if (error) throw error
      const grupos = (data ?? []) as GrupoAdicional[]
      // ordena as opções de cada grupo (a query nested não garante ordem)
      for (const g of grupos) {
        g.adicionais = (g.adicionais ?? [])
          .slice()
          .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))
      }
      return grupos
    },
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['grupos-adicionais', restauranteId] })
    // previews de vínculo em editores de produto refletem nome/regra do grupo
    qc.invalidateQueries({ queryKey: ['produtos-grupos'] })
  }

  // Salva o grupo e sincroniza as opções (insert/update/delete) numa só operação.
  const salvarGrupo = useMutation({
    mutationFn: async (input: SalvarGrupoInput) => {
      if (!restauranteId) throw new Error('Restaurante não definido')

      const grupoPayload = {
        nome: input.nome,
        selecao: input.selecao,
        obrigatorio: input.obrigatorio,
        min_escolhas: input.min_escolhas,
        max_escolhas: input.max_escolhas,
        ativo: input.ativo,
      }

      let grupoId = input.id
      if (grupoId) {
        const { error } = await supabase
          .from('grupos_adicionais')
          .update(grupoPayload)
          .eq('id', grupoId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('grupos_adicionais')
          .insert({ ...grupoPayload, restaurante_id: restauranteId })
          .select('id')
          .single()
        if (error) throw error
        grupoId = data.id as string
      }

      if (input.opcoesRemovidas.length > 0) {
        const { error } = await supabase
          .from('adicionais')
          .delete()
          .in('id', input.opcoesRemovidas)
        if (error) throw error
      }

      for (const op of input.opcoes) {
        if (op.id) {
          const { error } = await supabase
            .from('adicionais')
            .update({ nome: op.nome, preco: op.preco, disponivel: op.disponivel, ordem: op.ordem })
            .eq('id', op.id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('adicionais').insert({
            restaurante_id: restauranteId,
            grupo_id: grupoId,
            nome: op.nome,
            preco: op.preco,
            disponivel: op.disponivel,
            ordem: op.ordem,
          })
          if (error) throw error
        }
      }

      return grupoId
    },
    onSuccess: invalidate,
  })

  // Patch leve (ex.: toggle ativo a partir do card), sem mexer em opções.
  const patchGrupo = useMutation({
    mutationFn: async (input: { id: string; patch: Partial<GrupoAdicional> }) => {
      const { error } = await supabase
        .from('grupos_adicionais')
        .update(input.patch)
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const removeGrupo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('grupos_adicionais').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  // Quantos produtos perderão o vínculo se este grupo for excluído.
  const contarProdutosVinculados = async (grupoId: string): Promise<number> => {
    const { count, error } = await supabase
      .from('produtos_grupos')
      .select('id', { count: 'exact', head: true })
      .eq('grupo_id', grupoId)
    if (error) throw error
    return count ?? 0
  }

  return { ...list, salvarGrupo, patchGrupo, removeGrupo, contarProdutosVinculados }
}
