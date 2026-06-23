'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import EmptyState from '@/components/EmptyState'
import Spinner from '@/components/Spinner'
import StatusBadge from '@/components/StatusBadge'
import Toast from '@/components/Toast'
import CheckoutModal from './CheckoutModal'
import { fmt } from '@/lib/formatters'
import { subtotalItem, totalComanda } from '@/lib/calcComanda'
import { useComanda } from '@/lib/hooks/useComanda'
import { useItensComanda } from '@/lib/hooks/useItens'
import { cancelarComandaVazia } from '@/lib/cancelarComandaVazia'
import type { ItemPedido } from '@/types'

export default function ComandaDetalhe({ comandaId }: { comandaId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [toast, setToast] = useState({ visible: false, message: '' })

  // Toast "Pedido lançado para a cozinha" ao voltar do lançamento (?lancado=1)
  useEffect(() => {
    if (searchParams.get('lancado') === '1') {
      setToast({ visible: true, message: 'Pedido lançado para a cozinha' })
      router.replace(`/garcom/comanda/${comandaId}`)
    }
  }, [searchParams, comandaId, router])
  const [entregando, setEntregando] = useState(false)
  const [entregandoId, setEntregandoId] = useState<string | null>(null)
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null)
  const [cancelandoComanda, setCancelandoComanda] = useState(false)

  const cancelarComanda = async () => {
    if (cancelandoComanda) return
    setCancelandoComanda(true)
    try {
      await cancelarComandaVazia(comandaId)
      setToast({ visible: true, message: 'Comanda cancelada' })
      setTimeout(() => router.push('/garcom'), 900)
    } catch (e: any) {
      setCancelandoComanda(false)
      setToast({ visible: true, message: e.message || 'Erro ao cancelar a comanda.' })
    }
  }

  const comandaQ = useComanda(comandaId)
  const itensQ = useItensComanda(comandaId)

  // Realtime
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(`garcom-comanda-${comandaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'itens_pedido', filter: `comanda_id=eq.${comandaId}` },
        () => {
          qc.invalidateQueries({ queryKey: ['itens', 'comanda', comandaId] })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [comandaId, qc])

  const subtotal = useMemo(() => totalComanda(itensQ.data ?? []), [itensQ.data])

  const cancelarItem = async (id: string) => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('itens_pedido')
        .update({
          status: 'cancelado',
          cancelado_em: new Date().toISOString(),
          cancelado_por: user?.id ?? null,
        })
        .eq('id', id)
        .eq('status', 'novo')
        .select('id')
      if (error) throw error
      if (!data || data.length === 0) {
        setToast({ visible: true, message: 'Já estava em preparo, não foi possível cancelar.' })
        return
      }
      setToast({ visible: true, message: 'Item cancelado' })
      qc.invalidateQueries({ queryKey: ['itens', 'comanda', comandaId] })
    } catch (e: any) {
      setToast({ visible: true, message: e.message || 'Erro ao cancelar.' })
    }
  }

  const rounds = useMemo(() => groupRounds(itensQ.data ?? []), [itensQ.data])

  const prontos = useMemo(
    () => (itensQ.data ?? []).filter((it) => it.status === 'pronto'),
    [itensQ.data],
  )

  const entregarIds = async (ids: string[]) => {
    if (ids.length === 0) return
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('itens_pedido')
        .update({ status: 'entregue' })
        .in('id', ids)
      if (error) throw error
      qc.invalidateQueries({ queryKey: ['itens', 'comanda', comandaId] })
      setToast({
        visible: true,
        message: ids.length === 1 ? 'Item entregue ✓' : `${ids.length} itens entregues ✓`,
      })
    } catch (e: any) {
      setToast({ visible: true, message: e.message || 'Erro ao confirmar entrega.' })
    }
  }

  const entregarTodos = async () => {
    const ids = prontos.map((p) => p.id)
    setEntregando(true)
    await entregarIds(ids)
    setEntregando(false)
  }

  const entregarItem = async (id: string) => {
    setEntregandoId(id)
    await entregarIds([id])
    setEntregandoId(null)
  }

  if (comandaQ.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size={24} color="var(--accent)" />
      </div>
    )
  }

  if (comandaQ.isError || !comandaQ.data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <EmptyState
          icon="⚠️"
          title="Comanda não encontrada"
          action={
            <Link href="/garcom" className="text-sm underline" style={{ color: 'var(--accent)' }}>
              Voltar
            </Link>
          }
        />
      </div>
    )
  }

  const comanda = comandaQ.data as any
  const mesa = comanda.mesa
  const isFechada = comanda.status === 'fechada'
  const vazia = !itensQ.isLoading && (itensQ.data ?? []).length === 0

  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header
        className="px-6 py-4 flex items-center gap-3"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        <Link
          href="/garcom"
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ border: '1px solid var(--line)', color: 'var(--ink)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          {comanda.cliente_nome && (
            <div className="text-xs" style={{ color: 'var(--text-mid)' }}>
              {mesa?.nome}{comanda.cliente_cpf ? ` · ${fmt.cpfPartial(comanda.cliente_cpf)}` : ''}
            </div>
          )}
          <div className="serif text-lg" style={{ color: 'var(--ink)' }}>
            {comanda.cliente_nome || mesa?.nome}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pt-5 pb-56">
        {itensQ.isLoading && (
          <div className="py-16 flex justify-center"><Spinner size={20} color="var(--accent)" /></div>
        )}
        {(itensQ.data ?? []).length === 0 && !itensQ.isLoading && (
          <EmptyState icon="🍽️" title="Sem pedidos ainda" />
        )}

        {rounds.map((r, idx) => (
          <div key={idx} className="mb-6">
            <div className="flex items-baseline gap-3 mb-3">
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: 'var(--text-mid)' }}
              >
                Rodada {idx + 1}
              </span>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                {fmt.time(r.start)}
              </span>
            </div>
            {r.items.map((it) => {
              const isPronto = it.status === 'pronto'
              const isNovo   = it.status === 'novo'
              const canceled = it.status === 'cancelado'
              const confirming = confirmingCancelId === it.id
              return (
                <div
                  key={it.id}
                  className="flex items-start gap-3 py-3"
                  style={{ borderBottom: '1px solid var(--line)', opacity: canceled ? 0.55 : 1 }}
                >
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm"
                      style={{
                        color: 'var(--ink)',
                        textDecoration: canceled ? 'line-through' : 'none',
                      }}
                    >
                      {it.produto?.nome ?? '—'}{' '}
                      <span style={{ color: 'var(--text-mid)' }}>× {it.quantidade}</span>
                    </div>
                    {(it.adicionais ?? []).length > 0 && (
                      <div className="mt-0.5 flex flex-col gap-0.5">
                        {(it.adicionais ?? []).map((a) => (
                          <div key={a.id} className="text-xs flex items-center gap-1" style={{ color: 'var(--text-mid)' }}>
                            <span>+ {a.nome_snapshot}</span>
                            {a.preco_snapshot > 0 && (
                              <span className="mono-num" style={{ color: 'var(--accent)' }}>
                                ({fmt.currency(a.preco_snapshot)})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {it.obs && (
                      <div
                        className="text-xs italic mt-0.5"
                        style={{ color: 'var(--text-mid)' }}
                      >
                        ↳ {it.obs}
                      </div>
                    )}
                    <div className="mt-1">
                      {canceled ? (
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-full"
                          style={{ border: '1px solid var(--muted)', color: 'var(--muted)' }}
                        >
                          Cancelado
                        </span>
                      ) : (
                        <StatusBadge status={it.status} />
                      )}
                    </div>
                    {confirming && (
                      <div className="mt-2 flex items-center gap-2 animate-fade-in">
                        <span className="text-xs" style={{ color: 'var(--text-mid)' }}>
                          Cancelar este item?
                        </span>
                        <button
                          onClick={() => { cancelarItem(it.id); setConfirmingCancelId(null) }}
                          className="text-xs px-2 py-1 rounded-lg"
                          style={{ background: 'var(--accent)', color: '#FAF9F5', border: 'none' }}
                        >
                          Sim, cancelar
                        </button>
                        <button
                          onClick={() => setConfirmingCancelId(null)}
                          className="text-xs px-2 py-1 rounded-lg"
                          style={{ border: '1px solid var(--line)', color: 'var(--text-mid)' }}
                        >
                          Voltar
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div
                      className="mono-num text-sm font-bold"
                      style={{
                        color: canceled ? 'var(--muted)' : 'var(--ink)',
                        textDecoration: canceled ? 'line-through' : 'none',
                      }}
                    >
                      {fmt.currency(subtotalItem(it))}
                    </div>
                    {isPronto && !isFechada && (
                      <button
                        onClick={() => entregarItem(it.id)}
                        disabled={entregandoId === it.id}
                        className="text-xs font-bold rounded-lg flex items-center gap-1 px-2 py-1"
                        style={{
                          minHeight: 32,
                          background: 'var(--status-ready)',
                          color: '#FAF9F5',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {entregandoId === it.id ? (
                          <Spinner size={12} />
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 12l5 5 9-11" />
                            </svg>
                            Entreguei
                          </>
                        )}
                      </button>
                    )}
                    {isNovo && !isFechada && !confirming && (
                      <button
                        onClick={() => setConfirmingCancelId(it.id)}
                        aria-label="Cancelar item"
                        className="text-xs px-2 py-1 rounded-lg"
                        style={{ border: '1px solid var(--line)', color: 'var(--accent)' }}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Footer fixo */}
      <div
        className="absolute bottom-0 left-0 right-0 px-6 pt-4 pb-5 safe-bottom"
        style={{ background: 'var(--bg)', borderTop: '1px solid var(--line)' }}
      >
        <div className="flex justify-between items-baseline mb-4 pb-3" style={{ borderBottom: '1px solid var(--line)' }}>
          <span className="text-sm" style={{ color: 'var(--ink)' }}>Subtotal</span>
          <span
            className="serif mono-num text-2xl"
            style={{ color: 'var(--accent)', fontWeight: 500, lineHeight: 1 }}
          >
            {fmt.currency(subtotal)}
          </span>
        </div>

        {isFechada ? (
          <div className="text-center text-sm" style={{ color: 'var(--muted)' }}>
            Comanda já encerrada
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Link
              href={`/garcom/pedido?comanda=${comandaId}`}
              className="w-full rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              style={{ minHeight: 52, background: 'var(--primary)', color: '#FAF9F5', border: 'none' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Novo pedido
            </Link>
            {vazia ? (
              <button
                onClick={cancelarComanda}
                disabled={cancelandoComanda}
                className="w-full rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                style={{
                  minHeight: 52,
                  background: 'transparent',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent)',
                  cursor: cancelandoComanda ? 'not-allowed' : 'pointer',
                }}
              >
                {cancelandoComanda ? <Spinner size={14} color="var(--accent)" /> : 'Cancelar comanda vazia'}
              </button>
            ) : (
              <div className="flex gap-2">
                {prontos.length > 0 && (
                  <button
                    onClick={entregarTodos}
                    disabled={entregando}
                    className="flex-1 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                    style={{
                      minHeight: 52,
                      background: 'transparent',
                      color: 'var(--status-ready)',
                      border: '1px solid var(--status-ready)',
                    }}
                  >
                    {entregando ? (
                      <Spinner size={14} color="var(--status-ready)" />
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12l5 5 9-11" />
                        </svg>
                        Entregar ({prontos.length})
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => setCheckoutOpen(true)}
                  className="rounded-xl text-sm font-bold"
                  style={{
                    flex: prontos.length > 0 ? 2 : 1,
                    minHeight: 52,
                    background: 'var(--accent)',
                    color: '#FAF9F5',
                    border: 'none',
                  }}
                >
                  Encerrar e Cobrar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {checkoutOpen && (
        <CheckoutModal
          comandaId={comandaId}
          clienteNome={comanda.cliente_nome}
          mesaNome={mesa?.nome ?? ''}
          restauranteId={comanda.restaurante_id}
          itens={itensQ.data ?? []}
          subtotal={subtotal}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={() => {
            setToast({ visible: true, message: 'Comanda encerrada com sucesso!' })
            setTimeout(() => router.push('/garcom'), 1500)
          }}
        />
      )}

      <Toast
        visible={toast.visible}
        message={toast.message}
        onClose={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </div>
  )
}

function groupRounds(itens: ItemPedido[]): { start: string; items: ItemPedido[] }[] {
  if (itens.length === 0) return []
  const sorted = [...itens].sort(
    (a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime(),
  )
  const rounds: { start: string; items: ItemPedido[] }[] = []
  let current: { start: string; items: ItemPedido[] } | null = null
  for (const it of sorted) {
    if (!current) { current = { start: it.criado_em, items: [it] }; continue }
    const last = current.items[current.items.length - 1]
    const gap = new Date(it.criado_em).getTime() - new Date(last.criado_em).getTime()
    if (gap <= 2 * 60_000) current.items.push(it)
    else { rounds.push(current); current = { start: it.criado_em, items: [it] } }
  }
  if (current) rounds.push(current)
  return rounds
}
