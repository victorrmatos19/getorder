'use client'

import { fmt } from '@/lib/formatters'
import type { Metrica, Resumo } from './useDashboard'

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-xs" style={{ color: 'var(--muted)' }}>—</span>
  }
  const up = delta >= 0
  const cor = up ? 'var(--status-ready)' : 'var(--accent)'
  const pct = `${up ? '+' : ''}${Math.round(delta * 100)}%`
  return (
    <span className="text-xs font-bold" style={{ color: cor }}>
      {up ? '▲' : '▼'} {pct}
    </span>
  )
}

function Card({ label, valor, m }: { label: string; valor: string; m: Metrica }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
      <div className="text-xs mb-2" style={{ color: 'var(--text-mid)' }}>{label}</div>
      <div className="serif text-lg leading-tight truncate" style={{ color: 'var(--ink)', fontWeight: 500 }}>
        {valor}
      </div>
      <div className="mt-1"><DeltaBadge delta={m.delta} /> <span className="text-xs" style={{ color: 'var(--muted)' }}>vs anterior</span></div>
    </div>
  )
}

export default function ResumoCards({ resumo }: { resumo: Resumo }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <Card label="Faturamento" valor={fmt.currency(resumo.faturamento.atual)} m={resumo.faturamento} />
      <Card label="Ticket médio" valor={fmt.currency(resumo.ticketMedio.atual)} m={resumo.ticketMedio} />
      <Card label="Comandas" valor={String(resumo.comandas.atual)} m={resumo.comandas} />
      <Card label="Pessoas" valor={String(resumo.pessoas.atual)} m={resumo.pessoas} />
    </div>
  )
}
