'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import StaffHeader from '@/components/StaffHeader'
import EmptyState from '@/components/EmptyState'
import Spinner from '@/components/Spinner'
import { useRestaurante } from '@/lib/contexts/RestauranteContext'

type MesaLivre = { id: string; nome: string; tipo: string }

function useMesasLivres(restauranteId: string | null | undefined) {
  return useQuery({
    queryKey: ['mesas-livres', restauranteId],
    enabled: !!restauranteId,
    queryFn: async (): Promise<MesaLivre[]> => {
      const supabase = createClient()
      const [mesasRes, abertasRes] = await Promise.all([
        supabase
          .from('mesas')
          .select('id, nome, tipo')
          .eq('restaurante_id', restauranteId!)
          .eq('ativo', true)
          .order('nome'),
        supabase
          .from('comandas')
          .select('mesa_id')
          .eq('restaurante_id', restauranteId!)
          .eq('status', 'aberta'),
      ])
      if (mesasRes.error) throw mesasRes.error
      if (abertasRes.error) throw abertasRes.error
      const ocupadas = new Set((abertasRes.data ?? []).map((c) => c.mesa_id))
      return (mesasRes.data ?? []).filter((m) => !ocupadas.has(m.id)) as MesaLivre[]
    },
  })
}

export default function NovaComanda() {
  const router = useRouter()
  const { restauranteId } = useRestaurante()
  const { data: mesas = [], isLoading, isError, error, refetch } = useMesasLivres(restauranteId)
  const [busca, setBusca] = useState('')

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return mesas
    return mesas.filter((m) => m.nome.toLowerCase().includes(q))
  }, [mesas, busca])

  const voltar = (
    <Link
      href="/garcom"
      aria-label="Voltar"
      className="mr-3 -ml-2 w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
      style={{ color: 'var(--ink)' }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </Link>
  )

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <StaffHeader leftSlot={voltar} title="Nova comanda" subtitle="Escolha a mesa" />

      <div className="px-4 pt-4">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar mesa…"
          className="w-full px-4 text-base rounded-xl"
          style={{
            minHeight: 48,
            border: '1px solid var(--line)',
            background: 'var(--surface)',
            color: 'var(--ink)',
          }}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-8">
        {isLoading && (
          <div className="py-16 flex justify-center"><Spinner size={20} color="var(--accent)" /></div>
        )}
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
        {!isLoading && !isError && mesas.length === 0 && (
          <EmptyState icon="🍽️" title="Nenhuma mesa livre" description="Todas as mesas estão com comanda aberta." />
        )}
        {!isLoading && !isError && mesas.length > 0 && filtradas.length === 0 && (
          <EmptyState icon="🔍" title="Nada encontrado" description={`Nenhuma mesa para “${busca}”.`} />
        )}

        {filtradas.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {filtradas.map((m) => (
              <button
                key={m.id}
                onClick={() => router.push(`/garcom/pedido?mesa=${m.id}`)}
                className="rounded-xl px-4 py-5 text-left flex flex-col gap-1"
                style={{
                  minHeight: 72,
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  color: 'var(--ink)',
                }}
              >
                <span className="serif text-lg leading-none">{m.nome}</span>
                <span className="text-xs" style={{ color: 'var(--text-mid)' }}>
                  {m.tipo === 'quadra' ? 'Quadra' : 'Mesa'} · livre
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
