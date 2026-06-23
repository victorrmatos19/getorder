'use client'

import { fmt } from '@/lib/formatters'
import EmptyState from '@/components/EmptyState'
import type { Mix } from './useDashboard'

export default function MixPagamento({ mix }: { mix: Mix }) {
  const totalValor = mix.pagamentos.reduce((s, p) => s + p.valor, 0)
  if (mix.pagamentos.length === 0) {
    return <EmptyState icon="💳" title="Sem comandas no período" />
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {mix.pagamentos.map((p) => {
          const pct = totalValor ? Math.round((p.valor / totalValor) * 100) : 0
          return (
            <div key={p.forma}>
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-sm" style={{ color: 'var(--ink)' }}>{p.forma}</span>
                <span className="mono-num text-xs" style={{ color: 'var(--text-mid)' }}>
                  {p.qtd} comandas · {fmt.currency(p.valor)} ({pct}%)
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--line)' }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
              </div>
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Mini label="Taxa captada" valor={fmt.currency(mix.taxaCaptada)} />
        <Mini label="Comandas c/ taxa" valor={`${Math.round(mix.pctComTaxa * 100)}%`} />
        <Mini label="Pessoas/comanda" valor={mix.pessoasPorComanda.toFixed(1)} />
      </div>
    </div>
  )
}

function Mini({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}>
      <div className="text-xs mb-1" style={{ color: 'var(--text-mid)' }}>{label}</div>
      <div className="mono-num text-sm font-bold" style={{ color: 'var(--ink)' }}>{valor}</div>
    </div>
  )
}
