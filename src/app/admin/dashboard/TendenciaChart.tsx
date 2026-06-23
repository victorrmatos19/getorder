'use client'

import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'
import { fmt } from '@/lib/formatters'

export default function TendenciaChart({ data }: { data: { label: string; valor: number }[] }) {
  return (
    <div style={{ width: '100%', height: 200 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="grad-fat" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--text-mid)' }} interval="preserveStartEnd" minTickGap={16} />
          <YAxis hide />
          <Tooltip
            formatter={(v: number) => [fmt.currency(v), 'Faturamento']}
            labelStyle={{ color: 'var(--ink)' }}
            contentStyle={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 12 }}
          />
          <Area type="monotone" dataKey="valor" stroke="var(--primary)" strokeWidth={2} fill="url(#grad-fat)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
