'use client'

import { useState } from 'react'
import Link from 'next/link'
import StaffHeader from '@/components/StaffHeader'
import ProdutosTab from './ProdutosTab'
import CategoriasTab from './CategoriasTab'

type Tab = 'produtos' | 'categorias'

export default function CardapioAdminPage() {
  const [tab, setTab] = useState<Tab>('produtos')

  return (
    <>
      <StaffHeader title="Cardápio" subtitle="Admin" />

      <div
        className="flex gap-6 px-6"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        {(['produtos', 'categorias'] as Tab[]).map((t) => {
          const active = tab === t
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="py-3 text-sm"
              style={{
                color: active ? 'var(--ink)' : 'var(--muted)',
                fontWeight: active ? 700 : 400,
                borderBottom: active ? '2px solid var(--ink)' : '2px solid transparent',
                marginBottom: -1,
                background: 'transparent',
                border: 'none',
              }}
            >
              {t === 'produtos' ? 'Produtos' : 'Categorias'}
            </button>
          )
        })}
        <Link
          href="/admin/cardapio/adicionais"
          className="py-3 text-sm ml-auto flex items-center gap-1"
          style={{ color: 'var(--muted)', borderBottom: '2px solid transparent', marginBottom: -1 }}
        >
          Adicionais
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>

      {tab === 'produtos' ? <ProdutosTab /> : <CategoriasTab />}
    </>
  )
}
