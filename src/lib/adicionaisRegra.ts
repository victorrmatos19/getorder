import type { GrupoAdicional } from '@/types'

type RegraInput = Pick<GrupoAdicional, 'selecao' | 'obrigatorio' | 'min_escolhas' | 'max_escolhas'>

// Resumo em linguagem natural da regra de um grupo, ex.:
// "Escolha única · obrigatório" / "Múltipla · até 3 · opcional"
export function resumoRegra(g: RegraInput): string {
  const ob = g.obrigatorio ? 'obrigatório' : 'opcional'
  if (g.selecao === 'unica') return `Escolha única · ${ob}`

  const min = g.min_escolhas ?? 0
  const max = g.max_escolhas
  let faixa: string
  if (max == null && min <= 0) faixa = 'várias'
  else if (max == null) faixa = `mín. ${min}`
  else if (min <= 0) faixa = `até ${max}`
  else if (min === max) faixa = `exatamente ${min}`
  else faixa = `${min} a ${max}`
  return `Múltipla · ${faixa} · ${ob}`
}
