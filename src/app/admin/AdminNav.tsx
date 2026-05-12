'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/admin',               label: 'Painel',    match: (p: string) => p === '/admin' },
  { href: '/admin/cardapio',      label: 'Cardápio',  match: (p: string) => p.startsWith('/admin/cardapio') },
  { href: '/admin/mesas',         label: 'Mesas',     match: (p: string) => p.startsWith('/admin/mesas') },
  { href: '/admin/configuracoes', label: 'Configs',   match: (p: string) => p.startsWith('/admin/configuracoes') },
]

export default function AdminNav() {
  const pathname = usePathname()
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex safe-bottom"
      style={{ background: 'var(--bg)', borderTop: '1px solid var(--line)' }}
    >
      {ITEMS.map((item) => {
        const active = item.match(pathname)
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center justify-center py-3"
            style={{
              color: active ? 'var(--ink)' : 'var(--muted)',
              fontWeight: active ? 700 : 400,
              fontSize: 12,
            }}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
