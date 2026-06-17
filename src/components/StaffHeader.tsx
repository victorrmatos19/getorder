'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Logo from './Logo'

type Props = {
  subtitle?: string
  title: React.ReactNode
  variant?: 'light' | 'dark'
  rightSlot?: React.ReactNode
  leftSlot?: React.ReactNode
}

export default function StaffHeader({ subtitle, title, variant = 'light', rightSlot, leftSlot }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
  }, [])

  const logout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const isDark = variant === 'dark'

  return (
    <header
      className="flex items-center justify-between px-6 py-4 border-b"
      style={{
        background: isDark ? 'var(--primary-dk)' : 'var(--bg)',
        borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'var(--line)',
        color: isDark ? '#FAF9F5' : 'var(--ink)',
      }}
    >
      {leftSlot}
      <div className="min-w-0 flex-1">
        {subtitle && (
          <div
            className="text-xs uppercase tracking-wider mb-0.5"
            style={{ color: isDark ? 'rgba(250,249,245,0.6)' : 'var(--text-mid)' }}
          >
            {subtitle}
          </div>
        )}
        <div className="serif text-xl leading-none truncate" style={{ fontWeight: 500 }}>
          {title}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {rightSlot}
        {email && (
          <span
            className="hidden sm:inline text-xs"
            style={{ color: isDark ? 'rgba(250,249,245,0.55)' : 'var(--text-mid)' }}
          >
            {email}
          </span>
        )}
        <button
          type="button"
          onClick={logout}
          className="text-xs px-3 py-2 rounded-xl border"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'var(--line)',
            color: isDark ? '#FAF9F5' : 'var(--text-mid)',
            background: 'transparent',
          }}
        >
          Sair
        </button>
      </div>
    </header>
  )
}
