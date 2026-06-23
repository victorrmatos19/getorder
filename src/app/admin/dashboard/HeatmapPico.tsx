'use client'

import EmptyState from '@/components/EmptyState'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// intensidade 0..1 → cor verde-oliva da marca
function cor(n: number, max: number): string {
  if (n === 0 || max === 0) return 'var(--surface)'
  const t = 0.15 + 0.85 * (n / max)
  return `color-mix(in srgb, var(--primary) ${Math.round(t * 100)}%, var(--surface))`
}

export default function HeatmapPico({ matriz, max }: { matriz: number[][]; max: number }) {
  if (max === 0) {
    return <EmptyState icon="🗓️" title="Sem pedidos no período" />
  }
  // mostra só rótulos de hora de 3 em 3 para caber no mobile
  const horas = Array.from({ length: 24 }, (_, h) => h)
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div style={{ minWidth: 520 }}>
        <div className="flex">
          <div style={{ width: 34 }} />
          {horas.map((h) => (
            <div key={h} className="flex-1 text-center" style={{ fontSize: 9, color: 'var(--text-mid)' }}>
              {h % 3 === 0 ? `${h}h` : ''}
            </div>
          ))}
        </div>
        {matriz.map((linha, wd) => (
          <div key={wd} className="flex items-center" style={{ marginTop: 2 }}>
            <div style={{ width: 34, fontSize: 10, color: 'var(--text-mid)' }}>{DIAS[wd]}</div>
            {linha.map((n, h) => (
              <div
                key={h}
                className="flex-1"
                title={`${DIAS[wd]} ${h}h · ${n} ${n === 1 ? 'pedido' : 'pedidos'}`}
                style={{ height: 16, margin: 1, borderRadius: 3, background: cor(n, max) }}
              />
            ))}
          </div>
        ))}
        <div className="flex items-center gap-2 mt-3" style={{ fontSize: 10, color: 'var(--text-mid)' }}>
          <span>menos</span>
          <div className="flex gap-1">
            {[0.15, 0.4, 0.65, 1].map((t) => (
              <div key={t} style={{ width: 14, height: 10, borderRadius: 2, background: `color-mix(in srgb, var(--primary) ${Math.round(t * 100)}%, var(--surface))` }} />
            ))}
          </div>
          <span>mais</span>
        </div>
      </div>
    </div>
  )
}
