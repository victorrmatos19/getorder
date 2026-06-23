'use client'

import type { PeriodoKey } from '@/lib/periodo'

const OPCOES: { key: PeriodoKey; label: string }[] = [
  { key: 'hoje', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: 'mes', label: 'Mês' },
  { key: 'custom', label: 'Personalizado' },
]

type Props = {
  periodoKey: PeriodoKey
  onSelect: (key: PeriodoKey) => void
  customInicio: string
  customFim: string
  onCustom: (campo: 'inicio' | 'fim', valor: string) => void
}

export default function PeriodoSelector({ periodoKey, onSelect, customInicio, customFim, onCustom }: Props) {
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto" style={{ scrollSnapType: 'x mandatory' }}>
        {OPCOES.map((o) => {
          const active = periodoKey === o.key
          return (
            <button
              key={o.key}
              onClick={() => onSelect(o.key)}
              className="px-4 py-2 rounded-xl text-sm whitespace-nowrap shrink-0"
              style={{
                scrollSnapAlign: 'start',
                background: active ? 'var(--ink)' : 'transparent',
                color: active ? '#FAF9F5' : 'var(--text-mid)',
                border: `1px solid ${active ? 'var(--ink)' : 'var(--line)'}`,
                fontWeight: active ? 700 : 400,
              }}
            >
              {o.label}
            </button>
          )
        })}
      </div>

      {periodoKey === 'custom' && (
        <div className="flex items-center gap-2 mt-3">
          <input
            type="date"
            value={customInicio}
            max={customFim || undefined}
            onChange={(e) => onCustom('inicio', e.target.value)}
            className="flex-1 px-3 text-sm rounded-xl"
            style={{ minHeight: 44, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)' }}
          />
          <span className="text-xs" style={{ color: 'var(--text-mid)' }}>até</span>
          <input
            type="date"
            value={customFim}
            min={customInicio || undefined}
            onChange={(e) => onCustom('fim', e.target.value)}
            className="flex-1 px-3 text-sm rounded-xl"
            style={{ minHeight: 44, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)' }}
          />
        </div>
      )}
    </div>
  )
}
