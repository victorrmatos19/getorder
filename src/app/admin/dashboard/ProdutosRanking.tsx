'use client'

import { useMemo, useState } from 'react'
import { fmt } from '@/lib/formatters'
import EmptyState from '@/components/EmptyState'
import type { ProdutoLinha } from './useDashboard'

type Ordem = 'receita' | 'volume'

export default function ProdutosRanking({
  produtos,
  adicionais,
}: {
  produtos: ProdutoLinha[]
  adicionais: { nome: string; qtd: number }[]
}) {
  const [ordem, setOrdem] = useState<Ordem>('receita')

  const ordenados = useMemo(() => {
    const arr = [...produtos]
    arr.sort((a, b) => (ordem === 'receita' ? b.receita - a.receita : b.qtd - a.qtd))
    return arr
  }, [produtos, ordem])

  const top = ordenados.slice(0, 8)
  const cauda = ordenados.length > 8 ? ordenados.slice(-3).reverse() : []
  const maxValor = top.length ? (ordem === 'receita' ? top[0].receita : top[0].qtd) : 0

  if (produtos.length === 0) {
    return <EmptyState icon="🍽️" title="Sem vendas no período" description="Ajuste o período." />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <div className="flex gap-1 rounded-lg p-0.5" style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}>
          {(['receita', 'volume'] as Ordem[]).map((o) => (
            <button
              key={o}
              onClick={() => setOrdem(o)}
              className="text-xs px-2.5 py-1 rounded-md"
              style={{
                background: ordem === o ? 'var(--ink)' : 'transparent',
                color: ordem === o ? '#FAF9F5' : 'var(--text-mid)',
                fontWeight: ordem === o ? 700 : 400,
              }}
            >
              {o === 'receita' ? 'Receita' : 'Volume'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {top.map((p) => {
          const valor = ordem === 'receita' ? p.receita : p.qtd
          const pct = maxValor ? Math.max(4, Math.round((valor / maxValor) * 100)) : 0
          return (
            <div key={p.nome}>
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-sm truncate" style={{ color: 'var(--ink)' }}>{p.nome}</span>
                <span className="mono-num text-xs shrink-0 ml-2" style={{ color: 'var(--text-mid)' }}>
                  {p.qtd} un · {fmt.currency(p.receita)}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--line)' }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--primary)' }} />
              </div>
            </div>
          )
        })}
      </div>

      {cauda.length > 0 && (
        <div className="rounded-xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-mid)' }}>
            Menos vendidos (possível encalhe)
          </div>
          {cauda.map((p) => (
            <div key={p.nome} className="flex justify-between text-xs py-0.5" style={{ color: 'var(--text-mid)' }}>
              <span className="truncate">{p.nome}</span>
              <span className="mono-num shrink-0 ml-2">{p.qtd} un · {fmt.currency(p.receita)}</span>
            </div>
          ))}
        </div>
      )}

      {adicionais.length > 0 && (
        <div>
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-mid)' }}>
            Adicionais mais pedidos
          </div>
          <div className="flex flex-wrap gap-1.5">
            {adicionais.slice(0, 8).map((a) => (
              <span
                key={a.nome}
                className="text-xs px-2 py-1 rounded-full"
                style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)' }}
              >
                {a.nome} <span style={{ color: 'var(--text-mid)' }}>×{a.qtd}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
