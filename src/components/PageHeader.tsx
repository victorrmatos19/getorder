import type { ReactNode } from 'react'

type Props = {
  title: string
  subtitle?: string
  rightSlot?: ReactNode
  leftSlot?: ReactNode
  variant?: 'primary' | 'plain'
}

export default function PageHeader({
  title,
  subtitle,
  rightSlot,
  leftSlot,
  variant = 'plain',
}: Props) {
  const isPrimary = variant === 'primary'
  return (
    <header
      className="flex items-center gap-3 px-6 py-4 border-b"
      style={{
        background: isPrimary ? 'var(--primary)' : 'var(--bg)',
        borderColor: isPrimary ? 'transparent' : 'var(--line)',
        color: isPrimary ? '#FAF9F5' : 'var(--ink)',
      }}
    >
      {leftSlot}
      <div className="flex-1 min-w-0">
        {subtitle && (
          <div className="text-xs" style={{ color: isPrimary ? 'rgba(250,249,245,0.7)' : 'var(--text-mid)' }}>
            {subtitle}
          </div>
        )}
        <div className="serif text-lg leading-tight truncate" style={{ fontWeight: 500 }}>
          {title}
        </div>
      </div>
      {rightSlot}
    </header>
  )
}
