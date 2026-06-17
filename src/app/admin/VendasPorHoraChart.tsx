'use client'

import { BarChart, Bar, ResponsiveContainer, XAxis, Cell, LabelList } from 'recharts'

// Isolado num módulo próprio para ser carregado sob demanda (next/dynamic),
// mantendo o recharts (~400KB) fora do bundle inicial do /admin.
export default function VendasPorHoraChart({ hours }: { hours: { h: string; v: number }[] }) {
  return (
    <div style={{ width: '100%', height: 140 }}>
      <ResponsiveContainer>
        <BarChart data={hours} margin={{ top: 12, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="h" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--text-mid)' }} />
          <Bar dataKey="v" radius={[4, 4, 0, 0]}>
            {hours.map((_, i) => (
              <Cell key={i} fill={i === hours.length - 1 ? 'var(--accent)' : 'var(--primary)'} />
            ))}
            <LabelList
              dataKey="v"
              position="top"
              formatter={(v: number) => (v > 0 ? Math.round(v) : '')}
              style={{ fontSize: 10, fill: 'var(--text-mid)' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
