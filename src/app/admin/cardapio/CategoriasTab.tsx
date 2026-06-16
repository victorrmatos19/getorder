'use client'

import { useState } from 'react'
import EmptyState from '@/components/EmptyState'
import Spinner from '@/components/Spinner'
import Toast from '@/components/Toast'
import { useRestaurante } from '@/lib/contexts/RestauranteContext'
import { useCategoriasAdmin } from '@/lib/hooks/useCategoriasAdmin'
import type { Categoria } from '@/types'

export default function CategoriasTab() {
  const { restauranteId } = useRestaurante()
  const { data: categorias = [], isLoading, isError, refetch, upsert, remove } =
    useCategoriasAdmin(restauranteId)

  const [editing, setEditing] = useState<Categoria | null>(null)
  const [creating, setCreating] = useState(false)
  const [toast, setToast] = useState({ visible: false, message: '' })

  const moveOrdem = async (cat: Categoria, dir: -1 | 1) => {
    const sorted = [...categorias].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))
    const idx = sorted.findIndex((c) => c.id === cat.id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const other = sorted[swapIdx]
    try {
      await upsert.mutateAsync({
        id: cat.id, nome: cat.nome, emoji: cat.emoji,
        ordem: other.ordem, ativa: cat.ativa,
      })
      await upsert.mutateAsync({
        id: other.id, nome: other.nome, emoji: other.emoji,
        ordem: cat.ordem, ativa: other.ativa,
      })
    } catch (e: any) {
      setToast({ visible: true, message: e.message || 'Erro ao reordenar.' })
    }
  }

  return (
    <>
      <div className="px-6 py-3 flex justify-between items-center">
        <div className="text-xs" style={{ color: 'var(--text-mid)' }}>
          Categorias do seu restaurante
        </div>
        <button
          onClick={() => setCreating(true)}
          className="text-xs px-3 py-2 rounded-xl font-bold"
          style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none' }}
        >
          + Nova
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-4">
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
        {!isLoading && categorias.length === 0 && (
          <EmptyState icon="🏷️" title="Sem categorias" description="Crie sua primeira categoria." />
        )}

        <ul className="flex flex-col gap-2">
          {categorias.map((c, i) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-xl p-3"
              style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
            >
              <div className="flex flex-col">
                <button
                  onClick={() => moveOrdem(c, -1)}
                  disabled={i === 0}
                  aria-label="Subir"
                  className="w-7 h-7 rounded-md flex items-center justify-center"
                  style={{ border: '1px solid var(--line)', color: i === 0 ? 'var(--muted)' : 'var(--ink)' }}
                >
                  ▲
                </button>
                <button
                  onClick={() => moveOrdem(c, 1)}
                  disabled={i === categorias.length - 1}
                  aria-label="Descer"
                  className="w-7 h-7 rounded-md flex items-center justify-center mt-1"
                  style={{
                    border: '1px solid var(--line)',
                    color: i === categorias.length - 1 ? 'var(--muted)' : 'var(--ink)',
                  }}
                >
                  ▼
                </button>
              </div>
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0"
                style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}
                aria-hidden
              >
                {c.emoji ?? '🏷️'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate" style={{ color: 'var(--ink)' }}>
                  {c.nome}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-mid)' }}>
                  Ordem {c.ordem}
                </div>
              </div>
              <button
                onClick={() =>
                  upsert.mutate({
                    id: c.id, nome: c.nome, emoji: c.emoji, ordem: c.ordem, ativa: !c.ativa,
                  })
                }
                className="text-xs px-2 py-1 rounded-full"
                style={{
                  border: `1px solid ${c.ativa ? 'var(--status-ready)' : 'var(--muted)'}`,
                  color: c.ativa ? 'var(--status-ready)' : 'var(--muted)',
                }}
              >
                {c.ativa ? 'Ativa' : 'Inativa'}
              </button>
              <button
                onClick={() => setEditing(c)}
                className="text-xs px-3 py-2 rounded-xl"
                style={{ border: '1px solid var(--line)', color: 'var(--text-mid)' }}
              >
                Editar
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`Excluir "${c.nome}"?`)) return
                  try {
                    await remove.mutateAsync(c.id)
                    setToast({ visible: true, message: 'Categoria excluída' })
                  } catch (e: any) {
                    setToast({
                      visible: true,
                      message: e.message?.includes('foreign')
                        ? 'Há produtos vinculados a esta categoria.'
                        : (e.message || 'Erro ao excluir'),
                    })
                  }
                }}
                className="text-xs px-2 py-2 rounded-xl"
                style={{ border: '1px solid var(--line)', color: 'var(--accent)' }}
              >
                Excluir
              </button>
            </li>
          ))}
        </ul>
      </div>

      {(creating || editing) && (
        <CategoriaForm
          initial={editing}
          nextOrdem={Math.max(0, ...categorias.map((c) => c.ordem)) + 1}
          onClose={() => { setEditing(null); setCreating(false) }}
          onSubmit={async (d) => {
            try {
              await upsert.mutateAsync({ id: editing?.id, ...d })
              setEditing(null); setCreating(false)
              setToast({ visible: true, message: 'Categoria salva' })
            } catch (e: any) {
              setToast({ visible: true, message: e.message || 'Erro ao salvar' })
            }
          }}
          busy={upsert.isPending}
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

function CategoriaForm({
  initial, nextOrdem, onClose, onSubmit, busy,
}: {
  initial: Categoria | null
  nextOrdem: number
  onClose: () => void
  onSubmit: (d: { nome: string; emoji: string | null; ordem: number; ativa: boolean }) => void
  busy: boolean
}) {
  const [nome, setNome] = useState(initial?.nome ?? '')
  const [emoji, setEmoji] = useState(initial?.emoji ?? '')
  const [ordem, setOrdem] = useState((initial?.ordem ?? nextOrdem).toString())
  const [ativa, setAtiva] = useState(initial?.ativa ?? true)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={() => !busy && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full px-6 pt-6 pb-8 animate-slide-up safe-bottom"
        style={{ background: 'var(--bg)', borderRadius: '20px 20px 0 0' }}
      >
        <div className="serif text-xl mb-5" style={{ color: 'var(--ink)' }}>
          {initial ? 'Editar categoria' : 'Nova categoria'}
        </div>
        <div className="grid grid-cols-[80px_1fr] gap-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-mid)' }}>Emoji</label>
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="🍽️"
              className="w-full py-3 text-2xl text-center"
              style={{ border: 'none', borderBottom: '1px solid var(--line)', background: 'transparent' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-mid)' }}>Nome</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Bebidas"
              className="w-full py-3 text-base"
              style={{
                border: 'none', borderBottom: '1px solid var(--line)',
                background: 'transparent', color: 'var(--ink)',
              }}
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs mb-1" style={{ color: 'var(--text-mid)' }}>Ordem</label>
          <input
            value={ordem}
            onChange={(e) => setOrdem(e.target.value.replace(/[^0-9]/g, ''))}
            inputMode="numeric"
            className="w-full py-3 text-base mono-num"
            style={{
              border: 'none', borderBottom: '1px solid var(--line)',
              background: 'transparent', color: 'var(--ink)',
            }}
          />
        </div>
        <label className="flex items-center gap-3 mt-5 text-sm">
          <input
            type="checkbox"
            checked={ativa}
            onChange={(e) => setAtiva(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <span style={{ color: 'var(--ink)' }}>Categoria ativa (visível no cardápio)</span>
        </label>
        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-xl text-sm"
            style={{ minHeight: 48, border: '1px solid var(--line)', color: 'var(--text-mid)' }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onSubmit({
              nome: nome.trim(),
              emoji: emoji.trim() || null,
              ordem: parseInt(ordem || '0', 10) || 0,
              ativa,
            })}
            disabled={busy || !nome.trim()}
            className="rounded-xl text-sm font-bold"
            style={{
              flex: 2,
              minHeight: 48,
              background: nome.trim() ? 'var(--accent)' : 'var(--line)',
              color: nome.trim() ? '#FAF9F5' : 'var(--muted)',
              border: 'none',
            }}
          >
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
