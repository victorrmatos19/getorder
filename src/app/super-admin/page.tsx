'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import StaffHeader from '@/components/StaffHeader'
import EmptyState from '@/components/EmptyState'
import Spinner from '@/components/Spinner'
import { fmt } from '@/lib/formatters'
import type { Restaurante } from '@/types'

function useRestaurantes() {
  const supabase = createClient()
  return useQuery({
    queryKey: ['super-admin', 'restaurantes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurantes')
        .select('*')
        .order('criado_em', { ascending: false })
      if (error) throw error
      return (data ?? []) as Restaurante[]
    },
  })
}

export default function SuperAdminHome() {
  const { data: rests = [], isLoading, isError, error, refetch } = useRestaurantes()

  return (
    <>
      <StaffHeader
        title="Super Admin"
        subtitle="GetOrder SaaS"
        rightSlot={
          <Link
            href="/super-admin/restaurantes/novo"
            className="text-xs px-3 py-2 rounded-xl font-bold"
            style={{ background: 'var(--ink)', color: 'var(--bg)' }}
          >
            + Restaurante
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading && <div className="py-16 flex justify-center"><Spinner color="var(--accent)" /></div>}
        {isError && (
          <EmptyState
            icon="⚠️"
            title="Erro ao carregar"
            description={(error as any)?.message}
            action={
              <button onClick={() => refetch()} className="text-sm underline" style={{ color: 'var(--accent)' }}>
                Tentar novamente
              </button>
            }
          />
        )}
        {!isLoading && rests.length === 0 && (
          <EmptyState icon="🏢" title="Sem restaurantes" description="Crie o primeiro restaurante." />
        )}

        <ul className="flex flex-col gap-2">
          {rests.map((r) => (
            <li
              key={r.id}
              className="rounded-xl p-4 flex items-center gap-4"
              style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="serif text-lg" style={{ color: 'var(--ink)' }}>{r.nome}</div>
                <div className="text-xs" style={{ color: 'var(--text-mid)' }}>
                  /{r.slug} · criado em {fmt.date(r.criado_em)}
                </div>
              </div>
              <span
                className="text-xs px-2 py-1 rounded-full"
                style={{
                  border: `1px solid ${r.ativo ? 'var(--status-ready)' : 'var(--muted)'}`,
                  color: r.ativo ? 'var(--status-ready)' : 'var(--muted)',
                }}
              >
                {r.ativo ? 'Ativo' : 'Inativo'}
              </span>
              <Link
                href={`/super-admin/restaurantes/${r.id}`}
                className="text-xs px-3 py-2 rounded-xl"
                style={{ border: '1px solid var(--line)', color: 'var(--ink)' }}
              >
                Acessar
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
