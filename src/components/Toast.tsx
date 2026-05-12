'use client'

import { useEffect } from 'react'

type Props = {
  message: string
  visible: boolean
  onClose: () => void
  duration?: number
  variant?: 'success' | 'info' | 'error'
}

export default function Toast({ message, visible, onClose, duration = 3000, variant = 'success' }: Props) {
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(onClose, duration)
    return () => clearTimeout(t)
  }, [visible, duration, onClose])

  if (!visible) return null

  const color =
    variant === 'error' ? 'var(--accent)' :
    variant === 'success' ? 'var(--status-ready)' :
    'var(--ink)'

  return (
    <div
      role="status"
      className="fixed top-3 left-3 right-3 z-50 animate-slide-up rounded-xl px-4 py-3 text-sm flex items-center gap-2 shadow-sm"
      style={{ background: 'var(--ink)', color: 'var(--bg)', border: `1px solid ${color}` }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12l5 5 9-11" />
      </svg>
      <span className="flex-1">{message}</span>
    </div>
  )
}
