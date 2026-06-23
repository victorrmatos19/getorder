'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import StaffHeader from '@/components/StaffHeader'
import GeralTab from './GeralTab'
import HorarioTab from './HorarioTab'
import MarcaTab from './MarcaTab'

type Tab = 'geral' | 'marca' | 'horario' | 'mesas' | 'cardapio'

const TABS: { key: Tab; label: string; href?: string }[] = [
  { key: 'geral',    label: 'Geral' },
  { key: 'marca',    label: 'Marca' },
  { key: 'horario',  label: 'Horário' },
  { key: 'mesas',    label: 'Mesas',    href: '/admin/mesas' },
  { key: 'cardapio', label: 'Cardápio', href: '/admin/cardapio' },
]

export default function ConfiguracoesPage() {
  const pathname = usePathname()
  const [tab, setTab] = useState<Tab>('geral')

  return (
    <>
      <StaffHeader title="Configurações" subtitle="Admin" />

      <div
        className="flex gap-6 px-6 overflow-x-auto"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        {TABS.map((t) => {
          const active = !t.href && tab === t.key
          const inner = (
            <span
              className="py-3 text-sm whitespace-nowrap inline-block"
              style={{
                color: active ? 'var(--ink)' : 'var(--muted)',
                fontWeight: active ? 700 : 400,
                borderBottom: active ? '2px solid var(--ink)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t.label}
            </span>
          )
          return t.href ? (
            <Link key={t.key} href={t.href}>{inner}</Link>
          ) : (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="bg-transparent border-none"
            >
              {inner}
            </button>
          )
        })}
      </div>

      {tab === 'geral'   && <GeralTab />}
      {tab === 'marca'   && <MarcaTab />}
      {tab === 'horario' && <HorarioTab />}
    </>
  )
}
