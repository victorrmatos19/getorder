'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import EmptyState from '@/components/EmptyState'
import Spinner from '@/components/Spinner'
import Toast from '@/components/Toast'
import ProdutoForm from './ProdutoForm'
import { useRestaurante } from '@/lib/contexts/RestauranteContext'
import { useProdutos } from '@/lib/hooks/useProdutos'
import { useCategorias } from '@/lib/hooks/useCategorias'
import { fmt } from '@/lib/formatters'
import type { Produto } from '@/types'

export default function ProdutosTab() {
  const qc = useQueryClient()
  const { restauranteId } = useRestaurante()
  const { data: produtos = [], isLoading, isError, refetch } = useProdutos(restauranteId)
  const { data: categorias = [] } = useCategorias(restauranteId)

  const [activeCategoriaId, setActiveCategoriaId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Produto | null>(null)
  const [creating, setCreating] = useState(false)
  const [toast, setToast] = useState({ visible: false, message: '' })

  const currentCatId = activeCategoriaId ?? categorias[0]?.id ?? null

  const byCat = useMemo(
    () => produtos.filter((p) => p.categoria_id === currentCatId),
    [produtos, currentCatId],
  )

  const update = useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Produto> }) => {
      const supabase = createClient()
      const { error } = await supabase.from('produtos').update(input.patch).eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['produtos', restauranteId] }),
  })

  const remove = useMutation({
    mutationFn: async (p: Produto) => {
      const supabase = createClient()
      const { error } = await supabase.from('produtos').delete().eq('id', p.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['produtos', restauranteId] })
      setToast({ visible: true, message: 'Produto removido' })
    },
    onError: (e: any) => setToast({ visible: true, message: e.message || 'Erro ao remover' }),
  })

  return (
    <>
      <div className="px-6 py-3 flex justify-between items-center">
        <div className="text-xs" style={{ color: 'var(--text-mid)' }}>
          Cadastro de produtos
        </div>
        <button
          onClick={() => setCreating(true)}
          className="text-xs px-3 py-2 rounded-xl font-bold"
          style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none' }}
        >
          + Novo
        </button>
      </div>

      <div
        className="flex gap-6 px-6 overflow-x-auto"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        {categorias.length === 0 && (
          <div className="text-xs py-3" style={{ color: 'var(--muted)' }}>
            Crie uma categoria primeiro
          </div>
        )}
        {categorias.map((c) => {
          const active = currentCatId === c.id
          return (
            <button
              key={c.id}
              onClick={() => setActiveCategoriaId(c.id)}
              className="py-3 text-sm whitespace-nowrap"
              style={{
                color: active ? 'var(--ink)' : 'var(--muted)',
                fontWeight: active ? 700 : 400,
                borderBottom: active ? '2px solid var(--ink)' : '2px solid transparent',
                marginBottom: -1,
                background: 'transparent',
                border: 'none',
              }}
            >
              {c.emoji && <span aria-hidden className="mr-1">{c.emoji}</span>}
              {c.nome}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading && <div className="py-16 flex justify-center"><Spinner color="var(--accent)" /></div>}
        {isError && (
          <EmptyState
            icon="⚠️"
            title="Erro ao carregar"
            action={
              <button onClick={() => refetch()} className="text-sm underline" style={{ color: 'var(--accent)' }}>
                Tentar novamente
              </button>
            }
          />
        )}
        {!isLoading && byCat.length === 0 && categorias.length > 0 && (
          <EmptyState icon="🍽️" title="Sem produtos nesta categoria" />
        )}

        <ul className="flex flex-col gap-2">
          {byCat.map((p) => (
            <li
              key={p.id}
              className="flex items-start gap-3 rounded-xl p-3"
              style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
            >
              <div
                className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0"
                style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}
              >
                {p.foto_url ? (
                  <Image src={p.foto_url} alt={p.nome} fill sizes="56px" className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl" aria-hidden>🍽️</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex gap-1 mb-0.5">
                  {p.novidade && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                      style={{ background: 'var(--accent)', color: '#FAF9F5' }}>
                      NOVO
                    </span>
                  )}
                  {p.em_oferta && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                      style={{ border: '1px solid var(--accent)', color: 'var(--accent)' }}>
                      OFERTA
                    </span>
                  )}
                </div>
                <div className="text-sm font-bold truncate" style={{ color: 'var(--ink)' }}>{p.nome}</div>
                <div className="text-xs truncate" style={{ color: 'var(--text-mid)' }}>
                  {p.descricao || '—'}
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  {p.em_oferta && p.oferta_preco != null && (
                    <span className="mono-num text-xs line-through" style={{ color: 'var(--muted)' }}>
                      {fmt.currency(p.preco)}
                    </span>
                  )}
                  <span className="mono-num text-sm font-bold" style={{ color: 'var(--accent)' }}>
                    {fmt.currency(p.em_oferta && p.oferta_preco != null ? p.oferta_preco : p.preco)}
                  </span>
                </div>
                <div className="flex gap-1 flex-wrap mt-2">
                  <QuickToggle
                    label={p.disponivel ? 'Disponível' : 'Indisponível'}
                    active={p.disponivel}
                    onClick={() => update.mutate({ id: p.id, patch: { disponivel: !p.disponivel } })}
                  />
                  <QuickToggle
                    label="Esgotado"
                    active={p.esgotado}
                    onClick={() => update.mutate({ id: p.id, patch: { esgotado: !p.esgotado } })}
                  />
                  <QuickToggle
                    label="Novidade"
                    active={p.novidade}
                    onClick={() => update.mutate({ id: p.id, patch: { novidade: !p.novidade } })}
                  />
                  <QuickToggle
                    label="Oferta"
                    active={p.em_oferta}
                    onClick={() =>
                      update.mutate({
                        id: p.id,
                        patch: { em_oferta: !p.em_oferta, ...(!p.em_oferta ? {} : { oferta_preco: null }) },
                      })
                    }
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1 items-end shrink-0">
                <button
                  onClick={() => setEditing(p)}
                  className="text-xs px-2 py-1 rounded-lg"
                  style={{ border: '1px solid var(--line)', color: 'var(--text-mid)' }}
                >
                  Editar
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Remover "${p.nome}"?`)) remove.mutate(p)
                  }}
                  className="text-xs px-2 py-1 rounded-lg"
                  style={{ border: '1px solid var(--line)', color: 'var(--accent)' }}
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {(creating || editing) && (
        <ProdutoForm
          initial={editing}
          defaultCategoriaId={currentCatId}
          categorias={categorias}
          onClose={() => { setEditing(null); setCreating(false) }}
          onSaved={() => {
            setEditing(null); setCreating(false)
            qc.invalidateQueries({ queryKey: ['produtos', restauranteId] })
            setToast({ visible: true, message: 'Produto salvo' })
          }}
        />
      )}

      <Toast
        visible={toast.visible}
        message={toast.message}
        onClose={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </>
  )
}

function QuickToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[11px] px-2 py-1 rounded-full"
      style={{
        border: `1px solid ${active ? 'var(--status-ready)' : 'var(--line)'}`,
        color: active ? 'var(--status-ready)' : 'var(--muted)',
        background: 'transparent',
      }}
    >
      {label}
    </button>
  )
}
