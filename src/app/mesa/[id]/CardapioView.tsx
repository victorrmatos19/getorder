'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import BrandLogo from '@/components/BrandLogo'
import { deriveTheme } from '@/lib/theme'
import ProductCard from '@/components/ProductCard'
import EmptyState from '@/components/EmptyState'
import Spinner from '@/components/Spinner'
import Toast from '@/components/Toast'
import StatusBadge from '@/components/StatusBadge'
import ProdutoDetalhe from './ProdutoDetalhe'
import { fmt } from '@/lib/formatters'
import { subtotalItem, totalComanda, subtotalCartLine, totalCart } from '@/lib/calcComanda'
import type { CartLine } from '@/lib/calcComanda'
import { criarItemPedido } from '@/lib/itensPedido'
import { cancelarItemCliente } from '@/lib/comandaCliente'
import { useProdutos } from '@/lib/hooks/useProdutos'
import { useCategorias } from '@/lib/hooks/useCategorias'
import { useComandaCliente } from '@/lib/hooks/useComandaCliente'
import { useDisponibilidade } from '@/lib/hooks/useDisponibilidade'
import type { Categoria, ItemPedido, Mesa, Produto } from '@/types'

type Tab = 'cardapio' | 'comanda'
type SectionKey = 'novidades' | 'ofertas' | string

type Props = {
  mesa: Mesa
  comandaId: string
  onReset: () => void
}

export default function CardapioView({ mesa, comandaId, onReset }: Props) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('cardapio')
  const [section, setSection] = useState<SectionKey | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [modal, setModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({
    visible: false, message: '',
  })
  const [clienteNome, setClienteNome] = useState<string>('')
  const [detalhe, setDetalhe] = useState<Produto | null>(null)

  const produtosQ      = useProdutos(mesa.restaurante_id, { soDisponiveis: true })
  const categoriasQ    = useCategorias(mesa.restaurante_id, { soAtivas: true })
  const comandaQ       = useComandaCliente(comandaId)
  const disponibilidadeQ = useDisponibilidade(mesa.restaurante_id)

  const itens = comandaQ.data?.itens ?? []

  useEffect(() => {
    setClienteNome(comandaQ.data?.cliente_nome ?? '')
  }, [comandaQ.data?.cliente_nome])

  const produtos = produtosQ.data ?? []
  const categorias: Categoria[] = categoriasQ.data ?? []
  const podeReceber = disponibilidadeQ.data?.podeReceber ?? true
  const rest = disponibilidadeQ.data?.restaurante
  // Marca do restaurante (white-label): injeta os tokens derivados no container raiz.
  const themeVars = deriveTheme(rest?.cor_primaria, rest?.cor_accent, rest?.cor_preco) as React.CSSProperties

  const novidades = useMemo(() => produtos.filter((p) => p.novidade), [produtos])
  const ofertas   = useMemo(() => produtos.filter((p) => p.em_oferta && !p.novidade), [produtos])

  const produtosPorCategoria = useMemo(() => {
    const grouped: Record<string, Produto[]> = {}
    for (const c of categorias) grouped[c.id] = []
    for (const p of produtos) {
      const key = p.categoria_id ?? ''
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(p)
    }
    return grouped
  }, [produtos, categorias])

  const sections = useMemo(() => {
    const list: { key: SectionKey; label: string; emoji?: string; items: Produto[] }[] = []
    if (novidades.length) list.push({ key: 'novidades', label: 'Novidades', emoji: '🆕', items: novidades })
    if (ofertas.length)   list.push({ key: 'ofertas',   label: 'Em Oferta', emoji: '🔥', items: ofertas })
    for (const c of categorias) {
      const items = produtosPorCategoria[c.id] ?? []
      if (items.length === 0) continue
      list.push({ key: c.id, label: c.nome, emoji: c.emoji ?? undefined, items })
    }
    return list
  }, [novidades, ofertas, categorias, produtosPorCategoria])

  const activeSection = useMemo(
    () => sections.find((s) => s.key === section) ?? sections[0],
    [sections, section],
  )

  const cartCount = cart.reduce((a, l) => a + l.quantidade, 0)
  const cartTotal = useMemo(() => totalCart(cart), [cart])

  const addToCart = (line: CartLine) => setCart((c) => [...c, line])
  const removeFromCart = (key: string) => setCart((c) => c.filter((l) => l.key !== key))

  const enviarPedido = async () => {
    if (cart.length === 0 || !podeReceber) return
    setSubmitting(true)
    // Envia uma linha por vez via RPC (valida + snapshot no servidor).
    // Falha parcial: remove as que entraram, para na que falhou e mantém o resto.
    const enviadas: string[] = []
    let erro: string | null = null
    for (const l of cart) {
      try {
        await criarItemPedido({
          comandaId,
          produtoId: l.produto.id,
          quantidade: l.quantidade,
          observacao: l.observacao,
          adicionalIds: l.adicionais.map((a) => a.id),
        })
        enviadas.push(l.key)
      } catch (e: any) {
        erro = e.message || 'Erro ao enviar o pedido.'
        break
      }
    }
    setSubmitting(false)
    qc.invalidateQueries({ queryKey: ['comanda-cliente', comandaId] })

    if (erro) {
      setCart((c) => c.filter((l) => !enviadas.includes(l.key)))
      setToast({ visible: true, message: erro })
    } else {
      setCart([])
      setModal(false)
      setToast({ visible: true, message: 'Pedido enviado!' })
    }
  }

  const cancelarItem = async (id: string) => {
    try {
      const ok = await cancelarItemCliente(comandaId, id)
      if (!ok) {
        setToast({ visible: true, message: 'Já estava em preparo, não foi possível cancelar.' })
        return
      }
      setToast({ visible: true, message: 'Item cancelado' })
      qc.invalidateQueries({ queryKey: ['comanda-cliente', comandaId] })
    } catch (e: any) {
      setToast({ visible: true, message: e.message || 'Erro ao cancelar.' })
    }
  }

  const solicitarConta = () => {
    setToast({ visible: true, message: 'Garçom avisado! 🙌' })
  }

  return (
    <div className="min-h-screen flex flex-col relative" style={{ ...themeVars, background: 'var(--bg)' }}>
      {/* Header */}
      <div className="px-6 pt-4 pb-3 flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs mb-1" style={{ color: 'var(--text-mid)' }}>
            {mesa.nome}{clienteNome ? ` · ${clienteNome.split(' ')[0]}` : ''}
          </div>
          <BrandLogo logoUrl={rest?.logo_url} nome={rest?.nome} size="sm" showCobranding />
        </div>
        <button
          onClick={onReset}
          className="text-xs px-3 py-2 rounded-xl"
          style={{ border: '1px solid var(--line)', color: 'var(--text-mid)', background: 'transparent' }}
        >
          Sair
        </button>
      </div>

      {/* Banner de pausa / fora de horário */}
      {!podeReceber && tab === 'cardapio' && (
        <div
          className="mx-6 mb-2 rounded-xl px-4 py-3 flex items-start gap-2"
          style={{ background: 'var(--surface)', border: '1px solid var(--accent)' }}
        >
          <span aria-hidden className="text-base leading-none mt-0.5">⏸</span>
          <div className="min-w-0">
            <div className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
              {disponibilidadeQ.data?.motivo === 'pausa' ? 'Pedidos pausados' : 'Fora do horário de funcionamento'}
            </div>
            {disponibilidadeQ.data?.mensagem && (
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-mid)' }}>
                {disponibilidadeQ.data.mensagem}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex gap-6 px-6"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        {(['cardapio', 'comanda'] as Tab[]).map((t) => {
          const active = tab === t
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="py-3 text-sm transition-colors"
              style={{
                color: active ? 'var(--ink)' : 'var(--muted)',
                fontWeight: active ? 700 : 400,
                borderBottom: active ? '2px solid var(--ink)' : '2px solid transparent',
                marginBottom: -1,
                background: 'transparent',
                border: 'none',
                borderRadius: 0,
              }}
            >
              {t === 'cardapio' ? 'Cardápio' : 'Minha Comanda'}
            </button>
          )
        })}
      </div>

      {tab === 'cardapio' && (
        <>
          <div
            className="flex gap-2 px-6 py-3 overflow-x-auto"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {sections.map((s) => {
              const active = (activeSection?.key ?? null) === s.key
              const accent = s.key === 'ofertas' || s.key === 'novidades'
              return (
                <button
                  key={s.key}
                  onClick={() => setSection(s.key)}
                  className="px-4 py-2 rounded-xl text-sm whitespace-nowrap shrink-0"
                  style={{
                    scrollSnapAlign: 'start',
                    background: active ? (accent ? 'var(--accent)' : 'var(--ink)') : 'transparent',
                    color: active ? (accent ? 'var(--on-accent)' : '#FAF9F5') : (accent ? 'var(--accent)' : 'var(--text-mid)'),
                    border: active
                      ? `1px solid ${accent ? 'var(--accent)' : 'var(--ink)'}`
                      : `1px solid ${accent ? 'var(--accent)' : 'var(--line)'}`,
                    fontWeight: active ? 700 : 400,
                  }}
                >
                  {s.emoji && <span aria-hidden className="mr-1.5">{s.emoji}</span>}
                  {s.label}
                </button>
              )
            })}
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-32" key={activeSection?.key ?? 'empty'}>
            {(produtosQ.isLoading || categoriasQ.isLoading) && (
              <div className="py-16 flex justify-center"><Spinner size={20} color="var(--accent)" /></div>
            )}
            {produtosQ.isError && (
              <EmptyState
                icon="⚠️"
                title="Não foi possível carregar"
                description={(produtosQ.error as any)?.message}
                action={
                  <button onClick={() => produtosQ.refetch()} className="text-sm underline" style={{ color: 'var(--accent)' }}>
                    Tentar novamente
                  </button>
                }
              />
            )}
            {!produtosQ.isLoading && !produtosQ.isError && sections.length === 0 && (
              <EmptyState icon="🍽️" title="Nada por aqui ainda" description="Volte mais tarde." />
            )}
            {(activeSection?.items ?? []).map((p, i, arr) => (
              <ProductCard
                key={p.id}
                produto={p}
                isLast={i === arr.length - 1}
                onOpen={() => setDetalhe(p)}
              />
            ))}
          </div>

          {cart.length > 0 && (
            <div
              className="absolute bottom-0 left-0 right-0 px-6 pt-3 pb-4 animate-slide-up safe-bottom"
              style={{ background: 'var(--bg)', borderTop: '1px solid var(--line)' }}
            >
              <button
                onClick={() => setModal(true)}
                className="w-full rounded-xl flex items-center justify-between px-4 text-sm font-bold"
                style={{
                  minHeight: 52,
                  background: 'var(--accent)',
                  color: 'var(--on-accent)',
                  border: 'none',
                }}
              >
                <span className="text-xs opacity-80">
                  {cartCount} {cartCount === 1 ? 'item' : 'itens'}
                </span>
                <span>Ver pedido</span>
                <span className="mono-num">{fmt.currency(cartTotal)}</span>
              </button>
            </div>
          )}
        </>
      )}

      {tab === 'comanda' && (
        <MinhaComanda
          itens={itens}
          loading={comandaQ.isLoading}
          error={comandaQ.isError ? (comandaQ.error as any) : null}
          taxaPercentual={disponibilidadeQ.data?.restaurante?.taxa_servico_percentual ?? 10}
          onRefetch={() => comandaQ.refetch()}
          onCancelarItem={cancelarItem}
          onSolicitarConta={solicitarConta}
        />
      )}

      {modal && cart.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => !submitting && setModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full px-6 pt-6 pb-8 animate-slide-up safe-bottom max-h-[85vh] overflow-y-auto"
            style={{ background: 'var(--bg)', borderRadius: '20px 20px 0 0' }}
          >
            <div className="serif text-xl mb-5" style={{ color: 'var(--ink)' }}>Seu pedido</div>
            <div className="mb-5">
              {cart.map((l, i, arr) => (
                <div
                  key={l.key}
                  className="py-3 text-sm flex items-start gap-3"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <span style={{ color: 'var(--ink)' }}>
                        {l.produto.nome} <span style={{ color: 'var(--text-mid)' }}>× {l.quantidade}</span>
                      </span>
                      <span className="mono-num font-bold shrink-0" style={{ color: 'var(--ink)' }}>
                        {fmt.currency(subtotalCartLine(l))}
                      </span>
                    </div>
                    {l.adicionais.map((a) => (
                      <div key={a.id} className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-mid)' }}>
                        <span>+ {a.nome}</span>
                        {a.preco > 0 && (
                          <span className="mono-num" style={{ color: 'var(--price)' }}>({fmt.currency(a.preco)})</span>
                        )}
                      </div>
                    ))}
                    {l.observacao && (
                      <div className="text-xs italic mt-0.5" style={{ color: 'var(--text-mid)' }}>↳ {l.observacao}</div>
                    )}
                  </div>
                  <button
                    onClick={() => removeFromCart(l.key)}
                    aria-label="Remover item"
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ border: '1px solid var(--line)', color: 'var(--accent)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </div>
              ))}
            </div>
            <div
              className="flex justify-between items-baseline pt-3 mb-6"
              style={{ borderTop: '1px solid var(--line)' }}
            >
              <span className="text-base" style={{ color: 'var(--ink)' }}>Total</span>
              <span
                className="serif mono-num text-xl"
                style={{ color: 'var(--price)', fontWeight: 600 }}
              >
                {fmt.currency(cartTotal)}
              </span>
            </div>
            {!podeReceber && (
              <div className="text-xs mb-3 text-center" style={{ color: 'var(--accent)' }}>
                Pedidos indisponíveis no momento (pausa ou fora de horário).
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setModal(false)}
                disabled={submitting}
                className="flex-1 rounded-xl text-sm"
                style={{
                  minHeight: 48,
                  border: '1px solid var(--line)',
                  background: 'transparent',
                  color: 'var(--text-mid)',
                }}
              >
                Voltar
              </button>
              <button
                onClick={enviarPedido}
                disabled={submitting || !podeReceber}
                className="rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                style={{
                  flex: 2,
                  minHeight: 48,
                  background: submitting || !podeReceber ? 'var(--line)' : 'var(--accent)',
                  color: submitting || !podeReceber ? 'var(--muted)' : 'var(--on-accent)',
                  border: 'none',
                  cursor: submitting || !podeReceber ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? <><Spinner /> Enviando</> : 'Enviar pedido'}
              </button>
            </div>
          </div>
        </div>
      )}

      {detalhe && (
        <ProdutoDetalhe
          produto={detalhe}
          bloqueado={!podeReceber}
          onClose={() => setDetalhe(null)}
          onAddToCart={(line) => {
            addToCart(line)
            setToast({ visible: true, message: 'Adicionado ao pedido' })
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

function MinhaComanda({
  itens, loading, error, taxaPercentual, onRefetch, onCancelarItem, onSolicitarConta,
}: {
  itens: ItemPedido[]
  loading: boolean
  error: any
  taxaPercentual: number
  onRefetch: () => void
  onCancelarItem: (id: string) => void
  onSolicitarConta: () => void
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const rounds = useMemo(() => groupRounds(itens), [itens])
  const subtotal = totalComanda(itens)
  // Mesma fórmula/arredondamento do checkout do garçom (taxa aplicada por padrão)
  const servico = Math.round(subtotal * (taxaPercentual / 100) * 100) / 100
  const total = subtotal + servico

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-40">
        {loading && (
          <div className="py-16 flex justify-center"><Spinner size={20} color="var(--accent)" /></div>
        )}
        {error && (
          <EmptyState
            icon="⚠️"
            title="Não foi possível carregar"
            action={
              <button onClick={onRefetch} className="text-sm underline" style={{ color: 'var(--accent)' }}>
                Tentar novamente
              </button>
            }
          />
        )}
        {!loading && !error && itens.length === 0 && (
          <EmptyState
            icon="🍽️"
            title="Sua comanda está vazia"
            description="Faça seu primeiro pedido pelo cardápio."
          />
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
            {r.items.map((item, i, arr) => {
              const canceled = item.status === 'cancelado'
              const canCancel = item.status === 'novo'
              const confirming = confirmingId === item.id
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 py-3"
                  style={{
                    borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : '1px solid var(--line)',
                    opacity: canceled ? 0.55 : 1,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm"
                      style={{
                        color: 'var(--ink)',
                        textDecoration: canceled ? 'line-through' : 'none',
                      }}
                    >
                      {item.produto?.nome ?? '—'}{' '}
                      <span style={{ color: 'var(--text-mid)' }}>× {item.quantidade}</span>
                    </div>
                    {(item.adicionais ?? []).length > 0 && (
                      <div className="mt-0.5 flex flex-col gap-0.5">
                        {(item.adicionais ?? []).map((a) => (
                          <div key={a.id} className="text-xs flex items-center gap-1" style={{ color: 'var(--text-mid)' }}>
                            <span>+ {a.nome_snapshot}</span>
                            {a.preco_snapshot > 0 && (
                              <span className="mono-num" style={{ color: 'var(--price)' }}>
                                ({fmt.currency(a.preco_snapshot)})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {item.obs && (
                      <div
                        className="text-xs italic mt-0.5"
                        style={{ color: 'var(--text-mid)' }}
                      >
                        ↳ {item.obs}
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
                        <StatusBadge status={item.status} />
                      )}
                    </div>
                    {confirming && (
                      <div className="mt-2 flex items-center gap-2 animate-fade-in">
                        <span className="text-xs" style={{ color: 'var(--text-mid)' }}>
                          Cancelar este item?
                        </span>
                        <button
                          onClick={() => { onCancelarItem(item.id); setConfirmingId(null) }}
                          className="text-xs px-2 py-1 rounded-lg"
                          style={{ background: 'var(--accent)', color: 'var(--on-accent)', border: 'none' }}
                        >
                          Sim, cancelar
                        </button>
                        <button
                          onClick={() => setConfirmingId(null)}
                          className="text-xs px-2 py-1 rounded-lg"
                          style={{ border: '1px solid var(--line)', color: 'var(--text-mid)' }}
                        >
                          Voltar
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div
                      className="mono-num text-sm font-bold"
                      style={{
                        color: canceled ? 'var(--muted)' : 'var(--ink)',
                        textDecoration: canceled ? 'line-through' : 'none',
                      }}
                    >
                      {fmt.currency(subtotalItem(item))}
                    </div>
                    {canCancel && !confirming && (
                      <button
                        onClick={() => setConfirmingId(item.id)}
                        aria-label="Cancelar item"
                        className="w-6 h-6 flex items-center justify-center"
                        style={{ color: 'var(--muted)' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 px-6 pt-4 pb-5 safe-bottom"
        style={{ background: 'var(--bg)', borderTop: '1px solid var(--line)' }}
      >
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-sm" style={{ color: 'var(--text-mid)' }}>Subtotal</span>
          <span className="mono-num text-sm" style={{ color: 'var(--text-mid)' }}>
            {fmt.currency(subtotal)}
          </span>
        </div>
        {servico > 0 && (
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-sm" style={{ color: 'var(--text-mid)' }}>
              Taxa de serviço ({taxaPercentual}%)
            </span>
            <span className="mono-num text-sm" style={{ color: 'var(--text-mid)' }}>
              {fmt.currency(servico)}
            </span>
          </div>
        )}
        <div
          className="flex justify-between items-baseline mb-3 pt-2"
          style={{ borderTop: '1px solid var(--line)' }}
        >
          <span className="text-sm font-bold" style={{ color: 'var(--ink)' }}>Total</span>
          <span
            className="serif mono-num text-xl"
            style={{ color: 'var(--price)', fontWeight: 600 }}
          >
            {fmt.currency(total)}
          </span>
        </div>
        <button
          onClick={onSolicitarConta}
          disabled={itens.length === 0}
          className="w-full rounded-xl text-sm font-bold"
          style={{
            minHeight: 52,
            background: itens.length === 0 ? 'var(--line)' : 'var(--accent)',
            color: itens.length === 0 ? 'var(--muted)' : 'var(--on-accent)',
            border: 'none',
            cursor: itens.length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          Solicitar conta
        </button>
      </div>
    </>
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
    if (!current) {
      current = { start: it.criado_em, items: [it] }
      continue
    }
    const last = current.items[current.items.length - 1]
    const gap = new Date(it.criado_em).getTime() - new Date(last.criado_em).getTime()
    if (gap <= 2 * 60_000) current.items.push(it)
    else { rounds.push(current); current = { start: it.criado_em, items: [it] } }
  }
  if (current) rounds.push(current)
  return rounds
}
