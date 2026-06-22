'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import StaffHeader from '@/components/StaffHeader'
import ProductCard from '@/components/ProductCard'
import EmptyState from '@/components/EmptyState'
import Spinner from '@/components/Spinner'
import Toast from '@/components/Toast'
import ProdutoDetalhe from '@/app/mesa/[id]/ProdutoDetalhe'
import { fmt } from '@/lib/formatters'
import { subtotalCartLine, totalCart } from '@/lib/calcComanda'
import type { CartLine } from '@/lib/calcComanda'
import { lancarPedidoGarcom } from '@/lib/lancarPedidoGarcom'
import { useProdutos } from '@/lib/hooks/useProdutos'
import { useCategorias } from '@/lib/hooks/useCategorias'
import { useRestaurante } from '@/lib/contexts/RestauranteContext'
import type { Produto } from '@/types'

type Props = { mesaId: string | null; comandaId: string | null }

const TODOS = 'todos'

export default function PedidoGarcom({ mesaId, comandaId }: Props) {
  const router = useRouter()
  const { restauranteId } = useRestaurante()

  const [busca, setBusca] = useState('')
  const [catSel, setCatSel] = useState<string>(TODOS)
  const [cart, setCart] = useState<CartLine[]>([])
  const [detalhe, setDetalhe] = useState<Produto | null>(null)
  const [modal, setModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState({ visible: false, message: '' })

  const produtosQ = useProdutos(restauranteId, { soDisponiveis: true })
  const categoriasQ = useCategorias(restauranteId, { soAtivas: true })

  // Rótulo do alvo (mesa nova ou comanda existente)
  const alvoQ = useQuery({
    queryKey: ['pedido-alvo', mesaId, comandaId],
    enabled: !!(mesaId || comandaId),
    queryFn: async () => {
      const supabase = createClient()
      if (comandaId) {
        const { data } = await supabase
          .from('comandas')
          .select('id, mesa:mesas(nome)')
          .eq('id', comandaId)
          .maybeSingle()
        return (data as any)?.mesa?.nome ?? 'Comanda'
      }
      const { data } = await supabase.from('mesas').select('nome').eq('id', mesaId!).maybeSingle()
      return (data as any)?.nome ?? 'Mesa'
    },
  })

  const produtos = produtosQ.data ?? []
  const categorias = categoriasQ.data ?? []

  const chips = useMemo(
    () => [{ id: TODOS, nome: 'Todos', emoji: undefined as string | undefined }, ...categorias.map((c) => ({ id: c.id, nome: c.nome, emoji: c.emoji ?? undefined }))],
    [categorias],
  )

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return produtos.filter((p) => {
      if (catSel !== TODOS && p.categoria_id !== catSel) return false
      if (!q) return true
      return p.nome.toLowerCase().includes(q) || (p.descricao ?? '').toLowerCase().includes(q)
    })
  }, [produtos, catSel, busca])

  const cartCount = cart.reduce((a, l) => a + l.quantidade, 0)
  const cartTotal = useMemo(() => totalCart(cart), [cart])
  const addToCart = (line: CartLine) => setCart((c) => [...c, line])
  const removeFromCart = (key: string) => setCart((c) => c.filter((l) => l.key !== key))

  const lancar = async () => {
    if (cart.length === 0 || submitting) return
    setSubmitting(true)
    try {
      const id = await lancarPedidoGarcom({
        comandaId: comandaId ?? null,
        mesaId: mesaId ?? null,
        itens: cart.map((l) => ({
          produtoId: l.produto.id,
          quantidade: l.quantidade,
          observacao: l.observacao,
          adicionalIds: l.adicionais.map((a) => a.id),
        })),
      })
      // sucesso: vai pra comanda (o carrinho some junto com a tela);
      // ?lancado=1 mostra o toast "Pedido lançado para a cozinha" no destino
      router.push(`/garcom/comanda/${id}?lancado=1`)
    } catch (e: any) {
      setSubmitting(false)
      setToast({ visible: true, message: e.message || 'Erro ao lançar o pedido.' })
      // mantém o carrinho para retry
    }
  }

  const voltarHref = comandaId ? `/garcom/comanda/${comandaId}` : '/garcom/nova-comanda'
  const voltar = (
    <Link
      href={voltarHref}
      aria-label="Voltar"
      className="mr-3 -ml-2 w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
      style={{ color: 'var(--ink)' }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </Link>
  )

  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: 'var(--bg)' }}>
      <StaffHeader
        leftSlot={voltar}
        title={alvoQ.data ?? (mesaId || comandaId ? '…' : 'Pedido')}
        subtitle={comandaId ? 'Novo pedido · comanda' : 'Novo pedido · mesa'}
      />

      {/* Busca */}
      <div className="px-4 pt-4">
        <input
          autoFocus
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar produto…"
          className="w-full px-4 text-base rounded-xl"
          style={{ minHeight: 48, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)' }}
        />
      </div>

      {/* Chips de categoria */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto" style={{ scrollSnapType: 'x mandatory' }}>
        {chips.map((c) => {
          const active = catSel === c.id
          return (
            <button
              key={c.id}
              onClick={() => setCatSel(c.id)}
              className="px-4 py-2 rounded-xl text-sm whitespace-nowrap shrink-0"
              style={{
                scrollSnapAlign: 'start',
                background: active ? 'var(--ink)' : 'transparent',
                color: active ? '#FAF9F5' : 'var(--text-mid)',
                border: `1px solid ${active ? 'var(--ink)' : 'var(--line)'}`,
                fontWeight: active ? 700 : 400,
              }}
            >
              {c.emoji && <span aria-hidden className="mr-1.5">{c.emoji}</span>}
              {c.nome}
            </button>
          )
        })}
      </div>

      {/* Lista de produtos */}
      <div className="flex-1 overflow-y-auto px-6 pb-32">
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
        {!produtosQ.isLoading && !produtosQ.isError && produtos.length === 0 && (
          <EmptyState icon="🍽️" title="Nenhum produto" description="Cadastre produtos no cardápio." />
        )}
        {!produtosQ.isLoading && !produtosQ.isError && produtos.length > 0 && filtrados.length === 0 && (
          <EmptyState icon="🔍" title="Nada encontrado" description="Ajuste a busca ou a categoria." />
        )}
        {filtrados.map((p, i, arr) => (
          <ProductCard key={p.id} produto={p} isLast={i === arr.length - 1} onOpen={() => setDetalhe(p)} />
        ))}
      </div>

      {/* Barra do carrinho */}
      {cart.length > 0 && (
        <div
          className="absolute bottom-0 left-0 right-0 px-6 pt-3 pb-4 animate-slide-up safe-bottom"
          style={{ background: 'var(--bg)', borderTop: '1px solid var(--line)' }}
        >
          <button
            onClick={() => setModal(true)}
            className="w-full rounded-xl flex items-center justify-between px-4 text-sm font-bold"
            style={{ minHeight: 52, background: 'var(--accent)', color: '#FAF9F5', border: 'none' }}
          >
            <span className="text-xs opacity-80">{cartCount} {cartCount === 1 ? 'item' : 'itens'}</span>
            <span>Ver pedido</span>
            <span className="mono-num">{fmt.currency(cartTotal)}</span>
          </button>
        </div>
      )}

      {/* Resumo / lançar */}
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
            <div className="serif text-xl mb-5" style={{ color: 'var(--ink)' }}>Pedido</div>
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
                          <span className="mono-num" style={{ color: 'var(--accent)' }}>({fmt.currency(a.preco)})</span>
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
            <div className="flex justify-between items-baseline pt-3 mb-6" style={{ borderTop: '1px solid var(--line)' }}>
              <span className="text-base" style={{ color: 'var(--ink)' }}>Total</span>
              <span className="serif mono-num text-xl" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                {fmt.currency(cartTotal)}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setModal(false)}
                disabled={submitting}
                className="flex-1 rounded-xl text-sm"
                style={{ minHeight: 48, border: '1px solid var(--line)', background: 'transparent', color: 'var(--text-mid)' }}
              >
                Voltar
              </button>
              <button
                onClick={lancar}
                disabled={submitting}
                className="rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                style={{
                  flex: 2,
                  minHeight: 48,
                  background: submitting ? 'var(--line)' : 'var(--accent)',
                  color: submitting ? 'var(--muted)' : '#FAF9F5',
                  border: 'none',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? <><Spinner /> Lançando</> : 'Lançar pedido'}
              </button>
            </div>
          </div>
        </div>
      )}

      {detalhe && (
        <ProdutoDetalhe
          produto={detalhe}
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
