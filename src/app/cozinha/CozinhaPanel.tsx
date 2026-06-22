'use client'

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import StaffHeader from '@/components/StaffHeader'
import EmptyState from '@/components/EmptyState'
import Spinner from '@/components/Spinner'
import Toast from '@/components/Toast'
import { useItensCozinha } from '@/lib/hooks/useItens'
import { useCozinhaAlerta } from '@/lib/hooks/useCozinhaAlerta'
import { fmt } from '@/lib/formatters'
import type { ItemPedido, ItemStatus } from '@/types'

type ConexaoStatus = 'conectando' | 'ao_vivo' | 'reconectando' | 'sem_conexao'

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

// Relógio isolado: só ele re-renderiza a cada 1s (o grid de cards não).
const Relogio = memo(function Relogio() {
  const [hora, setHora] = useState(() =>
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  )
  useEffect(() => {
    const t = setInterval(
      () => setHora(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })),
      1000,
    )
    return () => clearInterval(t)
  }, [])
  return <>{hora}</>
})

const CONEXAO_CFG: Record<ConexaoStatus, { cor: string; label: string }> = {
  conectando:   { cor: 'rgba(250,249,245,0.45)', label: 'Conectando' },
  ao_vivo:      { cor: '#567D4F', label: 'Ao vivo' },
  reconectando: { cor: '#C8871E', label: 'Reconectando' },
  sem_conexao:  { cor: '#C56B56', label: 'Sem conexão' },
}

function ConexaoBadge({ status }: { status: ConexaoStatus }) {
  const cfg = CONEXAO_CFG[status]
  return (
    <span
      className="flex items-center gap-1.5 text-xs"
      style={{ color: 'rgba(250,249,245,0.62)' }}
      title={`Conexão em tempo real: ${cfg.label}`}
    >
      <span
        className="inline-block w-2 h-2 rounded-full shrink-0"
        style={{ background: cfg.cor }}
      />
      <span className="hidden sm:inline">{cfg.label}</span>
    </span>
  )
}

type Group = {
  key: string
  mesa: string
  cliente: string
  criadoMin: number
  itens: ItemPedido[]
}

export default function CozinhaPanel() {
  const qc = useQueryClient()
  const [toast, setToast] = useState({ visible: false, message: '' })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [conexao, setConexao] = useState<ConexaoStatus>('conectando')

  const { data: itens = [], isLoading, isError, error, refetch } = useItensCozinha()
  const { armado, mudo, armar, alternarMudo, tocar } = useCozinhaAlerta()

  // Debounce: vários itens do mesmo pedido (INSERTs em sequência) = um toque só.
  const tocarRef = useRef(tocar)
  tocarRef.current = tocar
  const alertaTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Realtime: invalida em qualquer evento; toca alerta SÓ em INSERT (pedido novo).
  useEffect(() => {
    const supabase = createClient()
    const agendarAlerta = () => {
      if (alertaTimer.current) clearTimeout(alertaTimer.current)
      alertaTimer.current = setTimeout(() => tocarRef.current(), 1500)
    }
    const ch = supabase
      .channel('cozinha-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'itens_pedido' },
        (payload) => {
          qc.invalidateQueries({ queryKey: ['itens', 'cozinha'] })
          if (payload.eventType === 'INSERT') agendarAlerta()
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConexao('ao_vivo')
        else if (status === 'CHANNEL_ERROR') setConexao('sem_conexao')
        else if (status === 'TIMED_OUT' || status === 'CLOSED') setConexao('reconectando')
      })
    return () => {
      if (alertaTimer.current) clearTimeout(alertaTimer.current)
      supabase.removeChannel(ch)
    }
  }, [qc])

  // Fallback de autoplay: o primeiro toque/clique em qualquer lugar arma o áudio
  // (além do botão "Ativar som" explícito no header).
  useEffect(() => {
    if (armado) return
    const onFirst = () => void armar()
    window.addEventListener('pointerdown', onFirst, { once: true })
    return () => window.removeEventListener('pointerdown', onFirst)
  }, [armado, armar])

  // Agrupar por comanda dentro de cada status (uma lista por coluna do kanban)
  const colunas = useMemo(() => {
    const maps: Record<Tab, Map<string, Group>> = {
      novo: new Map(),
      em_preparo: new Map(),
      pronto: new Map(),
    }
    for (const it of itens) {
      const status = it.status as Tab
      if (!(status in maps)) continue
      const map = maps[status]
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
    return TABS.map((t) => ({
      ...t,
      groups: Array.from(maps[t.key].values()).sort((a, b) => b.criadoMin - a.criadoMin),
    }))
  }, [itens])

  const counts = useMemo(() => {
    const c = { novo: 0, em_preparo: 0, pronto: 0 } as Record<Tab, number>
    for (const it of itens) {
      if (it.status in c) c[it.status as Tab] += 1
    }
    return c
  }, [itens])

  const avancar = async (group: Group, status: Tab) => {
    setBusyId(group.itens[0]?.id ?? null)
    try {
      const supabase = createClient()
      const ids = group.itens.map((i) => i.id)
      const { error } = await supabase
        .from('itens_pedido')
        .update({ status: NEXT_STATUS[status] })
        .in('id', ids)
      if (error) throw error
      qc.invalidateQueries({ queryKey: ['itens', 'cozinha'] })
    } catch (e: any) {
      setToast({ visible: true, message: e.message || 'Erro ao atualizar status.' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--primary-dk)', color: '#F2F0E8' }}>
      <StaffHeader
        variant="dark"
        subtitle="Cozinha · GetOrder"
        title={<Relogio />}
        rightSlot={
          <div className="flex items-center gap-2">
            <ConexaoBadge status={conexao} />
            {!armado ? (
              <button
                onClick={() => void armar()}
                className="text-xs font-bold rounded-lg px-3 flex items-center gap-1.5"
                style={{ minHeight: 40, background: 'var(--accent)', color: '#FAF9F5', border: 'none' }}
              >
                🔔 Ativar som
              </button>
            ) : (
              <button
                onClick={alternarMudo}
                aria-label={mudo ? 'Ativar som' : 'Silenciar'}
                className="text-base rounded-lg px-3 flex items-center justify-center"
                style={{
                  minWidth: 44,
                  minHeight: 40,
                  background: 'transparent',
                  color: mudo ? 'rgba(250,249,245,0.45)' : '#F2F0E8',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                {mudo ? '🔕' : '🔔'}
              </button>
            )}
          </div>
        }
      />

      {isError && (
        <div className="px-6 py-4">
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
        </div>
      )}
      {isLoading && (
        <div className="py-16 flex justify-center"><Spinner size={20} color="var(--accent-lt)" /></div>
      )}

      {/* Kanban: 3 colunas visíveis ao mesmo tempo (Novos / Preparando / Prontos) */}
      {!isError && !isLoading && (
        <div className="flex-1 min-h-0 overflow-x-auto px-6 py-4">
          <div className="flex gap-4 h-full">
            {colunas.map((col) => (
              <div key={col.key} className="flex flex-col min-h-0 min-w-[300px] flex-1">
                {/* Cabeçalho fixo da coluna */}
                <div
                  className="flex items-center gap-2 pb-3 mb-3 text-sm shrink-0"
                  style={{
                    color: col.color,
                    fontWeight: 700,
                    borderBottom: `2px solid ${col.color}`,
                  }}
                >
                  {col.label}
                  <span className="mono-num text-xs opacity-70">{counts[col.key]}</span>
                </div>

                {/* Lista rolável da coluna */}
                <div className="flex-1 overflow-y-auto pr-1 pb-8">
                  {col.groups.length === 0 && (
                    <div className="text-center py-12 text-sm" style={{ color: 'rgba(250,249,245,0.45)' }}>
                      Nenhum pedido neste estado.
                    </div>
                  )}

                  {col.groups.map((g) => {
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
                          onClick={() => avancar(g, col.key)}
                          disabled={busyId === g.itens[0]?.id}
                          className="w-full rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                          style={{
                            minHeight: 44,
                            background: col.color,
                            color: '#1A1E17',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          {busyId === g.itens[0]?.id ? <Spinner color="#1A1E17" /> : NEXT_LABEL[col.key]}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Toast
        visible={toast.visible}
        message={toast.message}
        onClose={() => setToast((t) => ({ ...t, visible: false }))}
        variant="error"
      />
    </div>
  )
}
