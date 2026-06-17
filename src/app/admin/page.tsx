'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import StaffHeader from '@/components/StaffHeader'
import Spinner from '@/components/Spinner'
import EmptyState from '@/components/EmptyState'
import StatusBadge from '@/components/StatusBadge'
import { fmt } from '@/lib/formatters'
import { useRestaurante } from '@/lib/contexts/RestauranteContext'
import type { Comanda, ItemPedido } from '@/types'

type RecentItem = ItemPedido & {
  produto?: { nome: string; preco: number }
  comanda?: Comanda & { mesa?: { nome: string } }
}

// Gráfico (recharts) carregado sob demanda — fora do bundle inicial do /admin.
const VendasPorHoraChart = dynamic(() => import('./VendasPorHoraChart'), {
  ssr: false,
  loading: () => <div style={{ height: 140 }} />,
})

function useDashboardData(restauranteId: string | null | undefined) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['admin-dashboard', restauranteId],
    enabled: !!restauranteId,
    queryFn: async () => {
      const start = new Date()
      start.setHours(0, 0, 0, 0)

      // Comandas fechadas hoje (filtro explícito por tenant — defesa em profundidade além da RLS)
      const { data: fechadas, error: e1 } = await supabase
        .from('comandas')
        .select('id, total, fechado_em, mesa:mesas(nome)')
        .eq('restaurante_id', restauranteId!)
        .eq('status', 'fechada')
        .gte('fechado_em', start.toISOString())
      if (e1) throw e1

      // Itens criados hoje (para top produto e contagem)
      const { data: itensHoje, error: e2 } = await supabase
        .from('itens_pedido')
        .select('id, quantidade, comanda_id, produto:produtos(nome, preco), comanda:comandas(mesa_id, mesa:mesas(nome), status), criado_em')
        .eq('restaurante_id', restauranteId!)
        .gte('criado_em', start.toISOString())
      if (e2) throw e2

      // Últimos 10 pedidos (itens recentes)
      const { data: recent, error: e3 } = await supabase
        .from('itens_pedido')
        .select('*, produto:produtos(nome, preco), comanda:comandas(*, mesa:mesas(nome))')
        .eq('restaurante_id', restauranteId!)
        .order('criado_em', { ascending: false })
        .limit(10)
      if (e3) throw e3

      return {
        fechadas: fechadas ?? [],
        itensHoje: itensHoje ?? [],
        recent: (recent ?? []) as unknown as RecentItem[],
      }
    },
    staleTime: 60_000,
  })
}

export default function AdminDashboardPage() {
  const { restauranteId } = useRestaurante()
  const { data, isLoading, isError, error, refetch } = useDashboardData(restauranteId)

  const stats = useMemo(() => {
    if (!data) return null
    const faturamento = data.fechadas.reduce((s, c: any) => s + (c.total ?? 0), 0)
    const pedidos = data.fechadas.length

    const produtoCount = new Map<string, number>()
    for (const it of data.itensHoje as any[]) {
      const nome = it.produto?.nome ?? '—'
      produtoCount.set(nome, (produtoCount.get(nome) ?? 0) + it.quantidade)
    }
    const topProduto = [...produtoCount.entries()].sort((a, b) => b[1] - a[1])[0]

    const mesaRev = new Map<string, number>()
    for (const c of data.fechadas as any[]) {
      const nome = c.mesa?.nome ?? '—'
      mesaRev.set(nome, (mesaRev.get(nome) ?? 0) + (c.total ?? 0))
    }
    const topMesa = [...mesaRev.entries()].sort((a, b) => b[1] - a[1])[0]

    // Vendas por hora — últimas 8h
    const now = new Date()
    const hours: { h: string; v: number }[] = []
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now)
      d.setHours(d.getHours() - i, 0, 0, 0)
      hours.push({ h: `${d.getHours().toString().padStart(2, '0')}h`, v: 0 })
    }
    for (const c of data.fechadas as any[]) {
      if (!c.fechado_em) continue
      const cd = new Date(c.fechado_em)
      const diffH = Math.floor((now.getTime() - cd.getTime()) / 3_600_000)
      if (diffH < 0 || diffH > 7) continue
      const idx = 7 - diffH
      hours[idx].v += c.total ?? 0
    }

    return { faturamento, pedidos, topProduto, topMesa, hours }
  }, [data])

  return (
    <>
      <StaffHeader title="Painel" subtitle={`GetOrder · ${new Date().toLocaleDateString('pt-BR')}`} />

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading && <div className="py-16 flex justify-center"><Spinner color="var(--accent)" /></div>}
        {isError && (
          <EmptyState
            icon="⚠️"
            title="Erro ao carregar"
            description={(error as any)?.message}
            action={
              <button onClick={() => refetch()} className="text-sm underline" style={{ color: 'var(--accent)' }}>
                Tentar novamente
              </button>
            }
          />
        )}
        {stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
              <MetricCard label="Faturamento hoje" value={fmt.currency(stats.faturamento)} />
              <MetricCard label="Pedidos hoje" value={String(stats.pedidos)} />
              <MetricCard
                label="Produto top"
                value={stats.topProduto?.[0] ?? '—'}
                sub={stats.topProduto ? `${stats.topProduto[1]} un.` : ''}
              />
              <MetricCard
                label="Mesa top"
                value={stats.topMesa?.[0] ?? '—'}
                sub={stats.topMesa ? fmt.currency(stats.topMesa[1]) : ''}
              />
            </div>

            <div
              className="rounded-xl p-4 mb-6"
              style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
            >
              <div className="flex justify-between items-baseline mb-3">
                <div className="text-sm font-bold" style={{ color: 'var(--ink)' }}>Vendas por hora</div>
                <div className="text-xs" style={{ color: 'var(--text-mid)' }}>últimas 8h</div>
              </div>
              <VendasPorHoraChart hours={stats.hours} />
            </div>

            <div
              className="rounded-xl p-4"
              style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
            >
              <div className="text-sm font-bold mb-3" style={{ color: 'var(--ink)' }}>Últimos pedidos</div>
              {(data?.recent ?? []).length === 0 && (
                <div className="text-xs py-4 text-center" style={{ color: 'var(--muted)' }}>
                  Sem atividade ainda.
                </div>
              )}
              {(data?.recent ?? []).map((it, i, arr) => (
                <div
                  key={it.id}
                  className="flex justify-between items-center py-3"
                  style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}
                >
                  <div className="min-w-0">
                    <div className="text-sm truncate" style={{ color: 'var(--ink)' }}>
                      {it.produto?.nome ?? '—'} <span style={{ color: 'var(--text-mid)' }}>× {it.quantidade}</span>
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-mid)' }}>
                      {(it.comanda?.mesa as any)?.nome ?? '—'} · {fmt.time(it.criado_em)}
                    </div>
                  </div>
                  <StatusBadge status={it.status} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
    >
      <div className="text-xs mb-2" style={{ color: 'var(--text-mid)' }}>{label}</div>
      <div className="serif text-lg leading-tight truncate" style={{ color: 'var(--ink)', fontWeight: 500 }}>
        {value}
      </div>
      {sub && (
        <div className="text-xs mt-1" style={{ color: 'var(--text-mid)' }}>{sub}</div>
      )}
    </div>
  )
}
