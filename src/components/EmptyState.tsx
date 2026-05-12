import type { ReactNode } from 'react'

type Props = {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 gap-3">
      {icon && (
        <div className="text-3xl mb-2" aria-hidden>
          {icon}
        </div>
      )}
      <div className="serif text-lg" style={{ color: 'var(--ink)' }}>{title}</div>
      {description && (
        <div className="text-sm max-w-xs" style={{ color: 'var(--muted)' }}>
          {description}
        </div>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
