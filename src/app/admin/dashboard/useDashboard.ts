'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { variacaoPct, type Periodo } from '@/lib/periodo'
import type { FormaPagamento } from '@/types'

// Linha de comanda fechada usada pelos blocos financeiros do período.
export type FechadaRow = {
  id: string
  total: number | null
  numero_pessoas: number
  taxa_servico_valor: number | null
  taxa_servico_aplicada: boolean
  forma_pagamento: FormaPagamento | null
  criado_em: string
  fechado_em: string | null
  mesa: { nome: string } | null
}

// Item de comanda fechada no período (ranking de produtos + receita).
export type ItemFechadoRow = {
  quantidade: number
  status: string
  preco_base_snapshot: number | null
  produto: { nome: string } | null
  adicionais: { nome_snapshot: string; preco_snapshot: number }[]
}

export type DashboardData = {
  fechadasAtual: FechadaRow[]
  fechadasAnt: FechadaRow[]
  itensFechadas: ItemFechadoRow[]
  itensPeriodo: { criado_em: string }[]            // demanda (heatmap), por criado_em
  canceladas: { cancelamento_motivo: string | null }[]
  itensCanceladosCount: number
}

// Busca comandas FECHADAS no período atual + anterior (numa tirada) e separa
// client-side por fechado_em. Financeiro = só 'fechada' (ignora aberta/cancelada).
export function useDashboard(restauranteId: string | null | undefined, periodo: Periodo) {
  return useQuery({
    queryKey: [
      'dashboard',
      restauranteId,
      periodo.key,
      periodo.inicio.toISOString(),
      periodo.fim.toISOString(),
    ],
    enabled: !!restauranteId,
    staleTime: 60_000,
    queryFn: async (): Promise<DashboardData> => {
      const supabase = createClient()
      const ini = periodo.inicio.toISOString()
      const fim = periodo.fim.toISOString()
      const [fechadasRes, itensRes, itensPeriodoRes, canceladasRes, itensCancRes] = await Promise.all([
        // comandas fechadas no período atual + anterior
        supabase
          .from('comandas')
          .select('id, total, numero_pessoas, taxa_servico_valor, taxa_servico_aplicada, forma_pagamento, criado_em, fechado_em, mesa:mesas(nome)')
          .eq('restaurante_id', restauranteId!)
          .eq('status', 'fechada')
          .gte('fechado_em', periodo.prevInicio.toISOString())
          .lte('fechado_em', fim)
          .order('fechado_em', { ascending: true }),
        // itens das comandas fechadas no período ATUAL (ranking de produtos)
        supabase
          .from('itens_pedido')
          .select('quantidade, status, preco_base_snapshot, produto:produtos(nome), comanda:comandas!inner(status, fechado_em), adicionais:itens_pedido_adicionais(nome_snapshot, preco_snapshot)')
          .eq('restaurante_id', restauranteId!)
          .eq('comanda.status', 'fechada')
          .neq('status', 'cancelado')
          .gte('comanda.fechado_em', ini)
          .lte('comanda.fechado_em', fim),
        // itens criados no período (demanda → heatmap), exceto cancelados
        supabase
          .from('itens_pedido')
          .select('criado_em')
          .eq('restaurante_id', restauranteId!)
          .neq('status', 'cancelado')
          .gte('criado_em', ini)
          .lte('criado_em', fim),
        // comandas canceladas no período (por motivo)
        supabase
          .from('comandas')
          .select('cancelamento_motivo')
          .eq('restaurante_id', restauranteId!)
          .eq('status', 'cancelada')
          .gte('cancelada_em', ini)
          .lte('cancelada_em', fim),
        // nº de itens cancelados no período
        supabase
          .from('itens_pedido')
          .select('id', { count: 'exact', head: true })
          .eq('restaurante_id', restauranteId!)
          .eq('status', 'cancelado')
          .gte('cancelado_em', ini)
          .lte('cancelado_em', fim),
      ])
      if (fechadasRes.error) throw fechadasRes.error
      if (itensRes.error) throw itensRes.error
      if (itensPeriodoRes.error) throw itensPeriodoRes.error
      if (canceladasRes.error) throw canceladasRes.error
      if (itensCancRes.error) throw itensCancRes.error

      const rows = (fechadasRes.data ?? []) as unknown as FechadaRow[]
      const corte = periodo.inicio.getTime()
      const fechadasAtual: FechadaRow[] = []
      const fechadasAnt: FechadaRow[] = []
      for (const r of rows) {
        const t = r.fechado_em ? new Date(r.fechado_em).getTime() : 0
        if (t >= corte) fechadasAtual.push(r)
        else fechadasAnt.push(r)
      }
      return {
        fechadasAtual,
        fechadasAnt,
        itensFechadas: (itensRes.data ?? []) as unknown as ItemFechadoRow[],
        itensPeriodo: (itensPeriodoRes.data ?? []) as { criado_em: string }[],
        canceladas: (canceladasRes.data ?? []) as { cancelamento_motivo: string | null }[],
        itensCanceladosCount: itensCancRes.count ?? 0,
      }
    },
  })
}

export type Metrica = { atual: number; anterior: number; delta: number | null }

export type Resumo = {
  faturamento: Metrica
  ticketMedio: Metrica
  comandas: Metrica
  pessoas: Metrica
}

function metrica(atual: number, anterior: number): Metrica {
  return { atual, anterior, delta: variacaoPct(atual, anterior) }
}

function agrega(rows: FechadaRow[]) {
  const faturamento = rows.reduce((s, c) => s + (c.total ?? 0), 0)
  const pessoas = rows.reduce((s, c) => s + (c.numero_pessoas ?? 0), 0)
  const n = rows.length
  return { faturamento, pessoas, n, ticket: n ? faturamento / n : 0 }
}

export function computeResumo(d: DashboardData): Resumo {
  const a = agrega(d.fechadasAtual)
  const b = agrega(d.fechadasAnt)
  return {
    faturamento: metrica(a.faturamento, b.faturamento),
    ticketMedio: metrica(a.ticket, b.ticket),
    comandas: metrica(a.n, b.n),
    pessoas: metrica(a.pessoas, b.pessoas),
  }
}

// ── Tendência: faturamento por bucket (dia ou hora) das comandas fechadas atuais ──
const DIA_MS = 24 * 60 * 60 * 1000

export function computeTendencia(
  fechadas: FechadaRow[],
  periodo: Periodo,
): { label: string; valor: number }[] {
  const buckets = new Map<string, number>()
  const ordem: { key: string; label: string }[] = []

  if (periodo.granularidade === 'hora') {
    for (let h = 0; h < 24; h++) {
      const key = `h${h}`
      ordem.push({ key, label: `${h.toString().padStart(2, '0')}h` })
      buckets.set(key, 0)
    }
    for (const c of fechadas) {
      if (!c.fechado_em) continue
      const h = new Date(c.fechado_em).getHours()
      buckets.set(`h${h}`, (buckets.get(`h${h}`) ?? 0) + (c.total ?? 0))
    }
  } else {
    const inicio = new Date(periodo.inicio)
    inicio.setHours(0, 0, 0, 0)
    const fimDia = new Date(periodo.fim).setHours(0, 0, 0, 0)
    for (let t = inicio.getTime(); t <= fimDia; t += DIA_MS) {
      const d = new Date(t)
      const key = d.toISOString().slice(0, 10)
      ordem.push({ key, label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) })
      buckets.set(key, 0)
    }
    for (const c of fechadas) {
      if (!c.fechado_em) continue
      const key = new Date(c.fechado_em).toISOString().slice(0, 10)
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + (c.total ?? 0))
    }
  }
  return ordem.map((o) => ({ label: o.label, valor: Math.round((buckets.get(o.key) ?? 0) * 100) / 100 }))
}

// ── Ranking de produtos (receita via snapshots) + adicionais mais pedidos ──
export type ProdutoLinha = { nome: string; qtd: number; receita: number }

export function computeProdutos(itens: ItemFechadoRow[]): {
  produtos: ProdutoLinha[]
  adicionais: { nome: string; qtd: number }[]
} {
  const prod = new Map<string, ProdutoLinha>()
  const adic = new Map<string, number>()
  for (const it of itens) {
    const nome = it.produto?.nome ?? '—'
    const base = it.preco_base_snapshot ?? 0
    const add = (it.adicionais ?? []).reduce((s, a) => s + (a.preco_snapshot ?? 0), 0)
    const receita = (base + add) * it.quantidade
    const cur = prod.get(nome) ?? { nome, qtd: 0, receita: 0 }
    cur.qtd += it.quantidade
    cur.receita = Math.round((cur.receita + receita) * 100) / 100
    prod.set(nome, cur)
    for (const a of it.adicionais ?? []) {
      adic.set(a.nome_snapshot, (adic.get(a.nome_snapshot) ?? 0) + it.quantidade)
    }
  }
  return {
    produtos: [...prod.values()],
    adicionais: [...adic.entries()].map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd),
  }
}

// ── Mix operacional (formas de pagamento, taxa, pessoas/comanda) ──
export type MixPagamentoLinha = { forma: string; qtd: number; valor: number }
export type Mix = {
  pagamentos: MixPagamentoLinha[]
  taxaCaptada: number
  pctComTaxa: number
  pessoasPorComanda: number
}

const FORMA_LABEL: Record<string, string> = {
  pix: 'Pix', debito: 'Débito', credito: 'Crédito', dinheiro: 'Dinheiro',
}

export function computeMix(fechadas: FechadaRow[]): Mix {
  const m = new Map<string, { qtd: number; valor: number }>()
  let taxa = 0
  let comTaxa = 0
  let pessoas = 0
  for (const c of fechadas) {
    const forma = c.forma_pagamento ?? '—'
    const cur = m.get(forma) ?? { qtd: 0, valor: 0 }
    cur.qtd += 1
    cur.valor += c.total ?? 0
    m.set(forma, cur)
    taxa += c.taxa_servico_valor ?? 0
    if (c.taxa_servico_aplicada) comTaxa += 1
    pessoas += c.numero_pessoas ?? 0
  }
  const n = fechadas.length
  return {
    pagamentos: [...m.entries()]
      .map(([forma, v]) => ({ forma: FORMA_LABEL[forma] ?? forma, qtd: v.qtd, valor: Math.round(v.valor * 100) / 100 }))
      .sort((a, b) => b.valor - a.valor),
    taxaCaptada: Math.round(taxa * 100) / 100,
    pctComTaxa: n ? comTaxa / n : 0,
    pessoasPorComanda: n ? pessoas / n : 0,
  }
}

// ── Heatmap dia-da-semana × hora (intensidade = nº de itens por criado_em) ──
export function computeHeatmap(itens: { criado_em: string }[]): { matriz: number[][]; max: number } {
  const matriz: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0))
  let max = 0
  for (const it of itens) {
    const d = new Date(it.criado_em)
    const wd = d.getDay()
    const h = d.getHours()
    matriz[wd][h] += 1
    if (matriz[wd][h] > max) max = matriz[wd][h]
  }
  return { matriz, max }
}

// ── Qualidade / giro ──
export type Qualidade = {
  itensCancelados: number
  comandasCanceladas: number
  porMotivo: { expiracao_automatica: number; cancelada_garcom: number }
  tempoMedioMesaMin: number | null
}

export function computeQualidade(d: DashboardData): Qualidade {
  const porMotivo = { expiracao_automatica: 0, cancelada_garcom: 0 }
  for (const c of d.canceladas) {
    if (c.cancelamento_motivo === 'expiracao_automatica') porMotivo.expiracao_automatica += 1
    else if (c.cancelamento_motivo === 'cancelada_garcom') porMotivo.cancelada_garcom += 1
  }
  let somaMin = 0
  let n = 0
  for (const c of d.fechadasAtual) {
    if (!c.fechado_em || !c.criado_em) continue
    const min = (new Date(c.fechado_em).getTime() - new Date(c.criado_em).getTime()) / 60000
    if (min >= 0 && min < 24 * 60) { somaMin += min; n += 1 } // ignora outliers > 24h
  }
  return {
    itensCancelados: d.itensCanceladosCount,
    comandasCanceladas: d.canceladas.length,
    porMotivo,
    tempoMedioMesaMin: n ? Math.round(somaMin / n) : null,
  }
}
