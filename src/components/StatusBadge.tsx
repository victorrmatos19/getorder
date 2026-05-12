import type { ItemStatus } from '@/types'

const MAP: Record<ItemStatus, { label: string; color: string }> = {
  novo:       { label: 'Aguardando', color: 'var(--status-new)' },
  em_preparo: { label: 'Preparando', color: 'var(--status-prep)' },
  pronto:     { label: 'Pronto ✓',  color: 'var(--status-ready)' },
  entregue:   { label: 'Entregue',   color: 'var(--muted)' },
  cancelado:  { label: 'Cancelado',  color: 'var(--muted)' },
}

export default function StatusBadge({ status }: { status: ItemStatus }) {
  const cfg = MAP[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold"
      style={{ color: cfg.color, background: 'transparent', border: `1px solid ${cfg.color}` }}
    >
      <span
        aria-hidden
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: cfg.color }}
      />
      {cfg.label}
    </span>
  )
}
