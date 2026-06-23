'use client'

import type { Qualidade } from './useDashboard'

function fmtMin(min: number | null): string {
  if (min === null) return '—'
  if (min < 60) return `${min}min`
  return `${Math.floor(min / 60)}h${(min % 60).toString().padStart(2, '0')}min`
}

export default function QualidadeGiro({ q }: { q: Qualidade }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Box label="Tempo médio de mesa" valor={fmtMin(q.tempoMedioMesaMin)} />
      <Box label="Itens cancelados" valor={String(q.itensCancelados)} />
      <Box
        label="Comandas canceladas"
        valor={String(q.comandasCanceladas)}
        sub={`${q.porMotivo.expiracao_automatica} auto · ${q.porMotivo.cancelada_garcom} garçom`}
      />
      <Box label="Auto vs garçom" valor={`${q.porMotivo.expiracao_automatica} / ${q.porMotivo.cancelada_garcom}`} sub="expiração / manual" />
    </div>
  )
}

function Box({ label, valor, sub }: { label: string; valor: string; sub?: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}>
      <div className="text-xs mb-1" style={{ color: 'var(--text-mid)' }}>{label}</div>
      <div className="mono-num text-base font-bold" style={{ color: 'var(--ink)' }}>{valor}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{sub}</div>}
    </div>
  )
}
