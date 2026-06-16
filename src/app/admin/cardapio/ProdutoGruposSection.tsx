'use client'

import Link from 'next/link'
import Spinner from '@/components/Spinner'
import EmptyState from '@/components/EmptyState'
import { useAdicionais } from '@/lib/hooks/useAdicionais'
import { useProdutoGrupos } from '@/lib/hooks/useProdutoGrupos'
import type { GrupoAdicional } from '@/types'

// Tag curta pro preview: "(obrigatório)" / "(até 3)" / "(opcional)"
function previewTag(g: GrupoAdicional): string {
  if (g.obrigatorio) return 'obrigatório'
  if (g.selecao === 'multipla' && g.max_escolhas != null) return `até ${g.max_escolhas}`
  if (g.selecao === 'multipla' && (g.min_escolhas ?? 0) > 0) return `mín. ${g.min_escolhas}`
  return 'opcional'
}

export default function ProdutoGruposSection({
  produtoId,
  restauranteId,
}: {
  produtoId: string | null | undefined
  restauranteId: string | null | undefined
}) {
  const gruposQ = useAdicionais(restauranteId)
  const { data: vinculos = [], isLoading: loadingVinc, vincular, desvincular, setOrdem } =
    useProdutoGrupos(produtoId, restauranteId)

  const grupos = gruposQ.data ?? []

  // Produto ainda não salvo: produtos_grupos precisa de produto_id.
  if (!produtoId) {
    return (
      <SectionShell>
        <div className="text-xs" style={{ color: 'var(--muted)' }}>
          Salve o produto primeiro para vincular grupos de adicionais.
        </div>
      </SectionShell>
    )
  }

  if (gruposQ.isLoading || loadingVinc) {
    return (
      <SectionShell>
        <div className="py-6 flex justify-center"><Spinner color="var(--accent)" /></div>
      </SectionShell>
    )
  }

  if (gruposQ.isError) {
    return (
      <SectionShell>
        <EmptyState
          icon="⚠️"
          title="Erro ao carregar grupos"
          action={
            <button onClick={() => gruposQ.refetch()} className="text-sm underline" style={{ color: 'var(--accent)' }}>
              Tentar novamente
            </button>
          }
        />
      </SectionShell>
    )
  }

  if (grupos.length === 0) {
    return (
      <SectionShell>
        <EmptyState
          icon="🧩"
          title="Nenhum grupo criado"
          description="Crie um grupo de adicionais primeiro."
          action={
            <Link
              href="/admin/cardapio/adicionais"
              className="text-sm underline"
              style={{ color: 'var(--accent)' }}
            >
              Ir para Adicionais
            </Link>
          }
        />
      </SectionShell>
    )
  }

  const ordemDe = new Map(vinculos.map((v) => [v.grupo_id, v.ordem]))
  const isVinculado = (id: string) => ordemDe.has(id)
  const proximaOrdem = vinculos.length

  // Preview dos vínculos, na ordem definida
  const preview = vinculos
    .filter((v) => v.grupo)
    .sort((a, b) => a.ordem - b.ordem)
    .map((v) => `${v.grupo!.nome} (${previewTag(v.grupo!)})`)

  return (
    <SectionShell>
      {preview.length > 0 && (
        <div
          className="text-xs mb-3 rounded-lg p-2"
          style={{ background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--text-mid)' }}
        >
          Este produto terá: <span style={{ color: 'var(--ink)' }}>{preview.join(', ')}</span>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {grupos.map((g) => {
          const vinc = isVinculado(g.id)
          return (
            <li key={g.id} className="flex items-center gap-3">
              <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={vinc}
                  onChange={(e) => {
                    if (e.target.checked) vincular.mutate({ grupoId: g.id, ordem: proximaOrdem })
                    else desvincular.mutate(g.id)
                  }}
                  style={{ width: 18, height: 18 }}
                />
                <span className="min-w-0">
                  <span className="text-sm block truncate" style={{ color: 'var(--ink)' }}>{g.nome}</span>
                  <span className="text-[11px]" style={{ color: 'var(--text-mid)' }}>{previewTag(g)}</span>
                </span>
              </label>
              {vinc && (
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs" style={{ color: 'var(--text-mid)' }}>ordem</span>
                  <input
                    value={String(ordemDe.get(g.id) ?? 0)}
                    onChange={(e) => {
                      const ordem = parseInt(e.target.value.replace(/[^0-9]/g, '') || '0', 10) || 0
                      setOrdem.mutate({ grupoId: g.id, ordem })
                    }}
                    inputMode="numeric"
                    className="py-1 text-sm mono-num text-center"
                    style={{
                      width: 44,
                      border: 'none',
                      borderBottom: '1px solid var(--line)',
                      background: 'transparent',
                      color: 'var(--ink)',
                    }}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </SectionShell>
  )
}

function SectionShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
      <div className="text-xs uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--text-mid)' }}>
        Adicionais e opções
      </div>
      {children}
    </div>
  )
}
