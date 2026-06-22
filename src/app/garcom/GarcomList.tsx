'use client'

import Link from 'next/link'
import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import StaffHeader from '@/components/StaffHeader'
import EmptyState from '@/components/EmptyState'
import Spinner from '@/components/Spinner'
import { fmt } from '@/lib/formatters'
import { totalComanda } from '@/lib/calcComanda'
import type { Comanda, ItemPedido, Mesa } from '@/types'

type ItemWithPreco = ItemPedido & { produto?: { preco: number } }
type Row = Comanda & { mesa: Mesa; itens: ItemWithPreco[] }

function useGarcomData() {
  const supabase = createClient()
  return useQuery({
    queryKey: ['garcom-mesas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comandas')
        .select('id, mesa_id, cliente_nome, criado_em, mesa:mesas(id, nome), itens:itens_pedido(id, status, quantidade, preco_base_snapshot, produto:produtos(preco), adicionais:itens_pedido_adicionais(preco_snapshot))')
        .eq('status', 'aberta')
        .order('criado_em')
      if (error) throw error
      return (data ?? []) as unknown as Row[]
    },
  })
}

export default function GarcomList() {
  const qc = useQueryClient()
  const { data: rows = [], isLoading, isError, error, refetch } = useGarcomData()

  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel('garcom-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas' }, () => {
        qc.invalidateQueries({ queryKey: ['garcom-mesas'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itens_pedido' }, () => {
        qc.invalidateQueries({ queryKey: ['garcom-mesas'] })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [qc])

  const byMesa = useMemo(() => {
    const m = new Map<string, { mesa: Mesa; comandas: Row[] }>()
    for (const c of rows) {
      const key = c.mesa.id
      const g = m.get(key) ?? { mesa: c.mesa, comandas: [] }
      g.comandas.push(c)
      m.set(key, g)
    }
    return Array.from(m.values()).sort((a, b) => a.mesa.nome.localeCompare(b.mesa.nome))
  }, [rows])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <StaffHeader
        title="Salão"
        subtitle="Garçom"
        rightSlot={
          <Link
            href="/garcom/nova-comanda"
            className="text-xs font-bold rounded-lg px-3 flex items-center gap-1.5"
            style={{ minHeight: 40, background: 'var(--accent)', color: '#FAF9F5' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nova comanda
          </Link>
        }
      />

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
        {!isLoading && !isError && byMesa.length === 0 && (
          <EmptyState icon="🍽️" title="Nenhuma mesa ocupada" description="Aguardando clientes." />
        )}

        <div className="flex flex-col gap-3">
          {byMesa.map(({ mesa, comandas }) => {
            const prontos = comandas
              .flatMap((c) => c.itens)
              .filter((i) => i.status === 'pronto').length
            const temPronto = prontos > 0

            // Card VERDE chamativo (texto branco) quando há item pronto para entregar;
            // caso contrário, mantém o visual neutro creme atual.
            const bgCard = temPronto ? 'var(--status-ready)' : 'var(--surface)'
            const borderCard = temPronto ? 'var(--status-ready)' : 'var(--line)'
            const corTexto = temPronto ? 'var(--bg)' : 'var(--ink)'
            const corSub = temPronto ? 'rgba(250,249,245,0.78)' : 'var(--text-mid)'
            const corPreco = temPronto ? 'var(--bg)' : 'var(--accent)'
            const corSeta = temPronto ? 'rgba(250,249,245,0.78)' : 'var(--muted)'
            const corLinha = temPronto ? 'rgba(255,255,255,0.18)' : 'var(--line)'

            return (
              <div
                key={mesa.id}
                className="rounded-xl"
                style={{
                  background: bgCard,
                  border: `1px solid ${borderCard}`,
                }}
              >
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: `1px solid ${corLinha}` }}
                >
                  <div className="serif text-lg" style={{ color: corTexto }}>{mesa.nome}</div>
                  <div className="flex items-center gap-2">
                    {temPronto && (
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ color: 'var(--bg)', border: '1px solid rgba(255,255,255,0.5)' }}
                      >
                        {prontos} prontos
                      </span>
                    )}
                    <span className="text-xs" style={{ color: corSub }}>
                      {comandas.length} {comandas.length === 1 ? 'comanda' : 'comandas'}
                    </span>
                  </div>
                </div>

                <ul>
                  {comandas.map((c) => {
                    const total = totalComanda(c.itens)
                    const itemsCount = c.itens.reduce((s, i) => s + i.quantidade, 0)
                    return (
                      <li key={c.id}>
                        <Link
                          href={`/garcom/comanda/${c.id}`}
                          className="flex items-center justify-between px-4 py-3"
                          style={{ minHeight: 56, borderTop: `1px solid ${corLinha}` }}
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-bold truncate" style={{ color: corTexto }}>
                              {c.cliente_nome || 'Comanda da mesa'}
                            </div>
                            <div className="text-xs" style={{ color: corSub }}>
                              {itemsCount} {itemsCount === 1 ? 'item' : 'itens'} · aberta {fmt.time(c.criado_em)}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className="mono-num text-sm font-bold"
                              style={{ color: corPreco }}
                            >
                              {fmt.currency(total)}
                            </span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: corSeta }}>
                              <path d="M5 12h14M13 6l6 6-6 6" />
                            </svg>
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
