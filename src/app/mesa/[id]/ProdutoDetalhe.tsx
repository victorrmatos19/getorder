'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Spinner from '@/components/Spinner'
import EmptyState from '@/components/EmptyState'
import { fmt } from '@/lib/formatters'
import { subtotalItem } from '@/lib/calcComanda'
import type { CartLine } from '@/lib/calcComanda'
import { useProdutoOpcoes } from '@/lib/hooks/useProdutoOpcoes'
import type { GrupoAdicional, ItemPedido, Produto } from '@/types'

const MAX_OBS = 200

type Props = {
  produto: Produto
  bloqueado?: boolean      // pedidos pausados / fora de horário
  onClose: () => void
  onAddToCart: (line: CartLine) => void
}

// Selo da regra do grupo
function seloRegra(g: GrupoAdicional): string {
  if (g.obrigatorio) return 'Obrigatório'
  if (g.selecao === 'unica') return 'Escolha 1'
  if (g.max_escolhas != null) return `Até ${g.max_escolhas}`
  if ((g.min_escolhas ?? 0) > 0) return `Mín. ${g.min_escolhas}`
  return 'Opcional'
}

// Mínimo exigido para considerar o grupo "satisfeito" (espelha a RPC)
function minExigido(g: GrupoAdicional): number {
  if (g.selecao === 'unica') return g.obrigatorio ? 1 : 0
  const min = g.min_escolhas ?? 0
  return g.obrigatorio ? Math.max(1, min) : min
}

export default function ProdutoDetalhe({ produto, bloqueado, onClose, onAddToCart }: Props) {
  const opcoesQ = useProdutoOpcoes(produto.id)
  const grupos = opcoesQ.data ?? []

  const [sel, setSel] = useState<Record<string, string[]>>({})
  const [quantidade, setQuantidade] = useState(1)
  const [observacao, setObservacao] = useState('')

  // índice id->adicional (nome + preço) p/ montar a linha do carrinho
  const adicionalById = useMemo(() => {
    const m = new Map<string, { nome: string; preco: number }>()
    for (const g of grupos) for (const a of g.adicionais ?? []) m.set(a.id, { nome: a.nome, preco: a.preco })
    return m
  }, [grupos])

  const idsSelecionados = useMemo(() => Object.values(sel).flat(), [sel])

  const toggle = (g: GrupoAdicional, adicionalId: string) => {
    setSel((prev) => {
      const atual = prev[g.id] ?? []
      if (g.selecao === 'unica') {
        // radio: toca de novo p/ limpar (se opcional); senão troca
        const next = atual[0] === adicionalId ? [] : [adicionalId]
        return { ...prev, [g.id]: next }
      }
      // múltipla
      if (atual.includes(adicionalId)) {
        return { ...prev, [g.id]: atual.filter((x) => x !== adicionalId) }
      }
      if (g.max_escolhas != null && atual.length >= g.max_escolhas) return prev
      return { ...prev, [g.id]: [...atual, adicionalId] }
    })
  }

  const gruposPendentes = useMemo(
    () => grupos.filter((g) => (sel[g.id]?.length ?? 0) < minExigido(g)).map((g) => g.id),
    [grupos, sel],
  )

  // Total ao vivo via helper (base = produto.preco, igual ao snapshot da RPC)
  const totalPreview = useMemo(
    () =>
      subtotalItem({
        preco_base_snapshot: produto.preco,
        quantidade,
        adicionais: idsSelecionados.map((id) => ({ preco_snapshot: adicionalById.get(id)?.preco ?? 0 })),
      } as unknown as ItemPedido),
    [produto.preco, quantidade, idsSelecionados, adicionalById],
  )

  const podeAdicionar = !bloqueado && !produto.esgotado && quantidade >= 1 && gruposPendentes.length === 0

  const confirmar = () => {
    if (!podeAdicionar) return
    const adicionais = idsSelecionados.map((id) => {
      const a = adicionalById.get(id)
      return { id, nome: a?.nome ?? '', preco: a?.preco ?? 0 }
    })
    onAddToCart({
      key: `${produto.id}-${idsSelecionados.join('.')}-${Date.now()}`,
      produto,
      quantidade,
      observacao: observacao.trim() || null,
      adicionais,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header className="px-6 py-4 flex items-center gap-3 shrink-0" style={{ borderBottom: '1px solid var(--line)' }}>
        <button
          onClick={onClose}
          aria-label="Voltar ao cardápio"
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ border: '1px solid var(--line)', color: 'var(--ink)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </button>
        <div className="serif text-lg truncate" style={{ color: 'var(--ink)' }}>{produto.nome}</div>
      </header>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto px-6 py-5 pb-40">
        {produto.foto_url && (
          <div className="relative w-full rounded-xl overflow-hidden mb-4" style={{ height: 180, background: 'var(--surface)' }}>
            <Image src={produto.foto_url} alt={produto.nome} fill sizes="100vw" className="object-cover" />
          </div>
        )}

        <div className="flex items-baseline justify-between gap-3">
          <div className="serif text-2xl" style={{ color: 'var(--ink)', lineHeight: 1.1 }}>{produto.nome}</div>
          <div className="mono-num text-base font-bold shrink-0" style={{ color: 'var(--accent)' }}>
            {fmt.currency(produto.preco)}
          </div>
        </div>
        {produto.descricao && (
          <div className="text-sm mt-2" style={{ color: 'var(--text-mid)', lineHeight: 1.4 }}>{produto.descricao}</div>
        )}

        {/* Estados da carga de opções */}
        {opcoesQ.isLoading && (
          <div className="py-10 flex justify-center"><Spinner size={20} color="var(--accent)" /></div>
        )}
        {opcoesQ.isError && (
          <div className="mt-6">
            <EmptyState
              icon="⚠️"
              title="Erro ao carregar opções"
              action={
                <button onClick={() => opcoesQ.refetch()} className="text-sm underline" style={{ color: 'var(--accent)' }}>
                  Tentar novamente
                </button>
              }
            />
          </div>
        )}

        {/* Grupos */}
        {grupos.map((g) => {
          const selecionadas = sel[g.id] ?? []
          const pendente = gruposPendentes.includes(g.id)
          const atingiuMax = g.selecao === 'multipla' && g.max_escolhas != null && selecionadas.length >= g.max_escolhas
          return (
            <div key={g.id} className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{g.nome}</div>
                <span
                  className="text-[11px] px-2 py-0.5 rounded-full"
                  style={{
                    border: `1px solid ${pendente ? 'var(--accent)' : 'var(--line)'}`,
                    color: pendente ? 'var(--accent)' : 'var(--text-mid)',
                  }}
                >
                  {seloRegra(g)}
                </span>
              </div>
              {pendente && (
                <div className="text-xs mb-2" style={{ color: 'var(--accent)' }}>
                  {g.selecao === 'unica' ? 'Selecione uma opção' : `Selecione ao menos ${minExigido(g)}`}
                </div>
              )}
              <div
                className="rounded-xl overflow-hidden"
                style={{ border: `1px solid ${pendente ? 'var(--accent)' : 'var(--line)'}` }}
              >
                {(g.adicionais ?? []).map((a, i, arr) => {
                  const checked = selecionadas.includes(a.id)
                  const disabled = !checked && atingiuMax
                  return (
                    <button
                      key={a.id}
                      onClick={() => !disabled && toggle(g, a.id)}
                      disabled={disabled}
                      className="w-full flex items-center gap-3 px-3 text-left"
                      style={{
                        minHeight: 48,
                        borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none',
                        background: checked ? 'var(--surface)' : 'transparent',
                        opacity: disabled ? 0.45 : 1,
                      }}
                    >
                      <span
                        className="flex items-center justify-center shrink-0"
                        style={{
                          width: 20, height: 20,
                          borderRadius: g.selecao === 'unica' ? '50%' : 6,
                          border: `2px solid ${checked ? 'var(--accent)' : 'var(--line)'}`,
                          background: checked ? 'var(--accent)' : 'transparent',
                        }}
                      >
                        {checked && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--on-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12l5 5 9-11" />
                          </svg>
                        )}
                      </span>
                      <span className="flex-1 text-sm" style={{ color: 'var(--ink)' }}>{a.nome}</span>
                      {a.preco > 0 && (
                        <span className="mono-num text-sm shrink-0" style={{ color: 'var(--accent)' }}>
                          + {fmt.currency(a.preco)}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Observação livre */}
        <div className="mt-6">
          <label className="block text-xs mb-1" style={{ color: 'var(--text-mid)' }}>Observação (opcional)</label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value.slice(0, MAX_OBS))}
            placeholder="Ex.: capricha no ponto, sem gelo"
            rows={2}
            maxLength={MAX_OBS}
            className="w-full text-base"
            style={{ padding: 12, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', resize: 'none', lineHeight: 1.4 }}
          />
        </div>

        {/* Quantidade */}
        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--ink)' }}>Quantidade</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantidade((n) => Math.max(1, n - 1))}
              disabled={quantidade <= 1}
              aria-label="Diminuir"
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ border: '1px solid var(--line)', color: quantidade <= 1 ? 'var(--muted)' : 'var(--ink)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 12h14" /></svg>
            </button>
            <span className="mono-num text-base font-bold" style={{ color: 'var(--ink)', minWidth: 24, textAlign: 'center' }}>{quantidade}</span>
            <button
              onClick={() => setQuantidade((n) => Math.min(99, n + 1))}
              aria-label="Aumentar"
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--bg)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>
        </div>

      </div>

      {/* Barra fixa */}
      <div
        className="absolute bottom-0 left-0 right-0 px-6 pt-3 pb-4 safe-bottom"
        style={{ background: 'var(--bg)', borderTop: '1px solid var(--line)' }}
      >
        <button
          onClick={confirmar}
          disabled={!podeAdicionar}
          className="w-full rounded-xl flex items-center justify-between px-4 text-sm font-bold"
          style={{
            minHeight: 52,
            background: podeAdicionar ? 'var(--accent)' : 'var(--line)',
            color: podeAdicionar ? 'var(--on-accent)' : 'var(--muted)',
            border: 'none',
            cursor: podeAdicionar ? 'pointer' : 'not-allowed',
          }}
        >
          {produto.esgotado ? (
            <span className="w-full text-center">Produto esgotado</span>
          ) : bloqueado ? (
            <span className="w-full text-center">Pedidos indisponíveis no momento</span>
          ) : gruposPendentes.length > 0 ? (
            <span className="w-full text-center">Selecione as opções obrigatórias</span>
          ) : (
            <>
              <span>Adicionar ao pedido</span>
              <span className="mono-num">{fmt.currency(totalPreview)}</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
