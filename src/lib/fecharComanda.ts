import { createClient } from '@/lib/supabase/client'
import type { FormaPagamento } from '@/types'

export type FecharComandaInput = {
  comandaId: string
  formaPagamento: FormaPagamento
  taxaAplicada: boolean
  numeroPessoas: number
}

/**
 * Fecha a comanda via RPC `fechar_comanda` (SECURITY DEFINER).
 *
 * O total e a taxa são RECOMPUTADOS no servidor a partir dos snapshots dos itens
 * (Discovery Cyber #6) — o client não envia mais o total. Retorna o total final.
 */
export async function fecharComanda({
  comandaId,
  formaPagamento,
  taxaAplicada,
  numeroPessoas,
}: FecharComandaInput): Promise<number> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('fechar_comanda', {
    p_comanda_id: comandaId,
    p_forma_pagamento: formaPagamento,
    p_taxa_aplicada: taxaAplicada,
    p_numero_pessoas: numeroPessoas,
  })
  if (error) throw error
  return Number(data)
}
