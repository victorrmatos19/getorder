'use client'

import { useState } from 'react'
import Link from 'next/link'
import StaffHeader from '@/components/StaffHeader'
import EmptyState from '@/components/EmptyState'
import Spinner from '@/components/Spinner'
import Toast from '@/components/Toast'
import { useRestaurante } from '@/lib/contexts/RestauranteContext'
import { useAdicionais } from '@/lib/hooks/useAdicionais'
import { resumoRegra } from '@/lib/adicionaisRegra'
import { fmt } from '@/lib/formatters'
import type { GrupoAdicional } from '@/types'
import GrupoForm from './GrupoForm'

export default function AdicionaisPage() {
  const { restauranteId } = useRestaurante()
  const {
    data: grupos = [], isLoading, isError, refetch,
    salvarGrupo, patchGrupo, removeGrupo, contarProdutosVinculados,
  } = useAdicionais(restauranteId)

  const [editing, setEditing] = useState<GrupoAdicional | null>(null)
  const [creating, setCreating] = useState(false)
  const [toast, setToast] = useState({ visible: false, message: '' })

  const excluir = async (g: GrupoAdicional) => {
    let n = 0
    try {
      n = await contarProdutosVinculados(g.id)
    } catch {
      /* se a contagem falhar, segue com aviso genérico */
    }
    const aviso = n > 0
      ? `Este grupo será removido de ${n} produto${n > 1 ? 's' : ''}. Excluir "${g.nome}"?`
      : `Excluir "${g.nome}"?`
    if (!confirm(aviso)) return
    try {
      await removeGrupo.mutateAsync(g.id)
      setToast({ visible: true, message: 'Grupo excluído' })
    } catch (e: any) {
      setToast({ visible: true, message: e.message || 'Erro ao excluir' })
    }
  }

  return (
    <>
      <StaffHeader
        title="Adicionais"
        subtitle="Cardápio"
        leftSlot={
          <Link
            href="/admin/cardapio"
            aria-label="Voltar ao cardápio"
            className="w-10 h-10 rounded-xl flex items-center justify-center mr-1"
            style={{ border: '1px solid var(--line)', color: 'var(--ink)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
          </Link>
        }
      />

      <div className="px-6 py-3 flex justify-between items-center">
        <div className="text-xs" style={{ color: 'var(--text-mid)' }}>
          Grupos de opções reutilizáveis entre produtos
        </div>
        <button
          onClick={() => setCreating(true)}
          className="text-xs px-3 py-2 rounded-xl font-bold"
          style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none' }}
        >
          + Novo grupo
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

        {!isLoading && !isError && grupos.length === 0 && (
          <EmptyState
            icon="🧩"
            title="Nenhum grupo de adicionais"
            description="Crie grupos como “Ponto da carne” ou “Adicionais” para reutilizar entre produtos."
          />
        )}

        <ul className="flex flex-col gap-3">
          {grupos.map((g) => (
            <li
              key={g.id}
              className="rounded-xl p-4"
              style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate" style={{ color: 'var(--ink)' }}>{g.nome}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-mid)' }}>{resumoRegra(g)}</div>
                </div>
                <button
                  onClick={() => patchGrupo.mutate({ id: g.id, patch: { ativo: !g.ativo } })}
                  className="text-xs px-2 py-1 rounded-full shrink-0"
                  style={{
                    border: `1px solid ${g.ativo ? 'var(--status-ready)' : 'var(--muted)'}`,
                    color: g.ativo ? 'var(--status-ready)' : 'var(--muted)',
                  }}
                >
                  {g.ativo ? 'Ativo' : 'Inativo'}
                </button>
              </div>

              {(g.adicionais ?? []).length > 0 && (
                <ul className="mt-3 flex flex-col gap-1">
                  {(g.adicionais ?? []).map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between text-sm"
                      style={{ color: a.disponivel ? 'var(--ink)' : 'var(--muted)' }}
                    >
                      <span className="truncate">
                        {a.nome}{!a.disponivel && ' · indisponível'}
                      </span>
                      <span className="mono-num shrink-0 ml-2" style={{ color: a.preco > 0 ? 'var(--accent)' : 'var(--text-mid)' }}>
                        {a.preco > 0 ? `+ ${fmt.currency(a.preco)}` : 'grátis'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setEditing(g)}
                  className="flex-1 rounded-xl text-xs py-2"
                  style={{ border: '1px solid var(--line)', color: 'var(--text-mid)' }}
                >
                  Editar
                </button>
                <button
                  onClick={() => excluir(g)}
                  className="rounded-xl text-xs py-2 px-4"
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
        <GrupoForm
          initial={editing}
          busy={salvarGrupo.isPending}
          onClose={() => { setEditing(null); setCreating(false) }}
          onSubmit={async (input) => {
            await salvarGrupo.mutateAsync(input)
            setEditing(null); setCreating(false)
            setToast({ visible: true, message: 'Grupo salvo' })
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
