'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import StaffHeader from '@/components/StaffHeader'
import EmptyState from '@/components/EmptyState'
import Spinner from '@/components/Spinner'
import Toast from '@/components/Toast'
import { useItensCozinha } from '@/lib/hooks/useItens'
import { fmt } from '@/lib/formatters'
import type { ItemPedido, ItemStatus } from '@/types'

// Agrupa os adicionais do item por grupo (grupo_nome_snapshot), preservando a
// ordem, em UPPER CASE — para a cozinha não perder ponto da carne nem "sem X".
function agruparAdicionais(it: ItemPedido): { grupo: string | null; nomes: string[] }[] {
  const grupos: { grupo: string | null; nomes: string[] }[] = []
  for (const a of it.adicionais ?? []) {
    const grupo = a.grupo_nome_snapshot ? a.grupo_nome_snapshot.toUpperCase() : null
    const nome = a.nome_snapshot.toUpperCase()
    const last = grupos[grupos.length - 1]
    if (last && last.grupo === grupo) last.nomes.push(nome)
    else grupos.push({ grupo, nomes: [nome] })
  }
  return grupos
}

type Tab = 'novo' | 'em_preparo' | 'pronto'

const TABS: { key: Tab; label: string; color: string }[] = [
  { key: 'novo',       label: 'Novos',      color: 'var(--status-new)' },
  { key: 'em_preparo', label: 'Preparando', color: 'var(--status-prep)' },
  { key: 'pronto',     label: 'Prontos',    color: 'var(--status-ready)' },
]

const NEXT_STATUS: Record<Tab, ItemStatus> = {
  novo: 'em_preparo',
  em_preparo: 'pronto',
  pronto: 'entregue',
}

const NEXT_LABEL: Record<Tab, string> = {
  novo: 'Iniciar Preparo',
  em_preparo: 'Marcar Pronto',
  pronto: 'Confirmar Entrega',
}

export default function CozinhaPanel() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('novo')
  const [now, setNow] = useState(() => new Date())
  const [toast, setToast] = useState({ visible: false, message: '' })
  const [busyId, setBusyId] = useState<string | null>(null)

  const { data: itens = [], isLoading, isError, error, refetch } = useItensCozinha()

  // Relógio
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Realtime
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel('cozinha-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'itens_pedido' },
        () => {
          qc.invalidateQueries({ queryKey: ['itens', 'cozinha'] })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [qc])

  // Agrupar por comanda+status do tab atual
  const groups = useMemo(() => {
    type Group = {
      key: string
      mesa: string
      cliente: string
      criadoMin: number
      itens: ItemPedido[]
    }
    const map = new Map<string, Group>()
    for (const it of itens) {
      if (it.status !== tab) continue
      const key = it.comanda_id
      const mesa = (it.comanda as any)?.mesa?.nome ?? 'Mesa'
      const cliente = (it.comanda as any)?.cliente_nome ?? ''
      const g = map.get(key)
      const min = fmt.elapsedMin(it.criado_em)
      if (g) {
        g.itens.push(it)
        if (min > g.criadoMin) g.criadoMin = min
      } else {
        map.set(key, { key, mesa, cliente, criadoMin: min, itens: [it] })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.criadoMin - a.criadoMin)
  }, [itens, tab])

  const counts = useMemo(() => {
    const c = { novo: 0, em_preparo: 0, pronto: 0 } as Record<Tab, number>
    for (const it of itens) {
      if (it.status in c) c[it.status as Tab] += 1
    }
    return c
  }, [itens])

  const avancar = async (group: { itens: ItemPedido[] }) => {
    setBusyId(group.itens[0]?.id ?? null)
    try {
      const supabase = createClient()
      const ids = group.itens.map((i) => i.id)
      const { error } = await supabase
        .from('itens_pedido')
        .update({ status: NEXT_STATUS[tab] })
        .in('id', ids)
      if (error) throw error
      qc.invalidateQueries({ queryKey: ['itens', 'cozinha'] })
    } catch (e: any) {
      setToast({ visible: true, message: e.message || 'Erro ao atualizar status.' })
    } finally {
      setBusyId(null)
    }
  }

  const horarioStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const tabCfg = TABS.find((x) => x.key === tab)!

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--primary-dk)', color: '#F2F0E8' }}>
      <StaffHeader
        variant="dark"
        subtitle="Cozinha · GetOrder"
        title={horarioStr}
      />

      {/* Tabs */}
      <div
        className="flex gap-6 px-6"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        {TABS.map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="py-3 text-sm flex items-center gap-2"
              style={{
                color: active ? t.color : 'rgba(250,249,245,0.45)',
                fontWeight: active ? 700 : 400,
                borderBottom: active ? `2px solid ${t.color}` : '2px solid transparent',
                marginBottom: -1,
                background: 'transparent',
                border: 'none',
                borderRadius: 0,
              }}
            >
              {t.label}
              <span className="mono-num text-xs opacity-70">{counts[t.key]}</span>
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 pb-8" key={tab}>
        {isLoading && (
          <div className="py-16 flex justify-center"><Spinner size={20} color="var(--accent-lt)" /></div>
        )}
        {isError && (
          <EmptyState
            icon="⚠️"
            title="Não foi possível carregar"
            description={(error as any)?.message}
            action={
              <button onClick={() => refetch()} className="text-sm underline" style={{ color: '#C56B56' }}>
                Tentar novamente
              </button>
            }
          />
        )}
        {!isLoading && !isError && groups.length === 0 && (
          <div className="text-center py-20 text-sm" style={{ color: 'rgba(250,249,245,0.45)' }}>
            Nenhum pedido neste estado.
          </div>
        )}

        {groups.map((g) => {
          const urgent = g.criadoMin > 15
          const danger = '#E08A74'
          return (
            <div
              key={g.key}
              className="rounded-xl p-4 mb-3"
              style={{
                background: '#242821',
                border: `1px solid ${urgent ? danger : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="min-w-0">
                  <div className="text-base font-bold leading-tight" style={{ color: '#F2F0E8' }}>
                    {g.mesa}
                  </div>
                  {g.cliente && (
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(250,249,245,0.62)' }}>
                      {g.cliente}
                    </div>
                  )}
                </div>
                <div
                  className="flex items-center gap-1 text-xs shrink-0"
                  style={{ color: urgent ? danger : 'rgba(250,249,245,0.62)', fontWeight: urgent ? 700 : 400 }}
                >
                  {urgent && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={danger} strokeWidth="1.8">
                      <path d="M12 3l10 18H2L12 3z" />
                      <path d="M12 10v5M12 18v.5" />
                    </svg>
                  )}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  <span className="mono-num">{g.criadoMin} min</span>
                </div>
              </div>

              <div className="mb-4">
                {g.itens.map((it) => (
                  <div key={it.id} className="text-sm py-1.5" style={{ color: '#F2F0E8' }}>
                    {it.produto?.nome ?? '—'} <span className="opacity-60">× {it.quantidade}</span>
                    {agruparAdicionais(it).map((gr, idx) => (
                      <div
                        key={idx}
                        className="text-sm font-bold mt-1 px-2 py-1 rounded uppercase"
                        style={{
                          color: '#E08A74',
                          background: 'rgba(224,138,116,0.08)',
                          borderLeft: '3px solid #E08A74',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {gr.grupo ? `${gr.grupo}: ` : '› '}{gr.nomes.join(', ')}
                      </div>
                    ))}
                    {it.obs && (
                      <div
                        className="text-sm font-bold mt-1 px-2 py-1 rounded"
                        style={{
                          color: '#E08A74',
                          background: 'rgba(224,138,116,0.08)',
                          borderLeft: '3px solid #E08A74',
                        }}
                      >
                        ↳ {it.obs}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={() => avancar(g)}
                disabled={busyId === g.itens[0]?.id}
                className="w-full rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                style={{
                  minHeight: 44,
                  background: tabCfg.color,
                  color: '#1A1E17',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {busyId === g.itens[0]?.id ? <Spinner color="#1A1E17" /> : NEXT_LABEL[tab]}
              </button>
            </div>
          )
        })}
      </div>

      <Toast
        visible={toast.visible}
        message={toast.message}
        onClose={() => setToast((t) => ({ ...t, visible: false }))}
        variant="error"
      />
    </div>
  )
}
