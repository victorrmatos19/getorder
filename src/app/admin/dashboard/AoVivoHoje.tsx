'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fmt } from '@/lib/formatters'

// Pulso operacional do dia (independente do seletor de período), com realtime:
// faturamento de hoje (comandas fechadas hoje) + nº de comandas abertas agora.
function useAoVivo(restauranteId: string | null | undefined) {
  return useQuery({
    queryKey: ['dashboard-aovivo', restauranteId],
    enabled: !!restauranteId,
    queryFn: async () => {
      const supabase = createClient()
      const inicio = new Date()
      inicio.setHours(0, 0, 0, 0)
      const [fechadasRes, abertasRes] = await Promise.all([
        supabase
          .from('comandas')
          .select('total')
          .eq('restaurante_id', restauranteId!)
          .eq('status', 'fechada')
          .gte('fechado_em', inicio.toISOString()),
        supabase
          .from('comandas')
          .select('id', { count: 'exact', head: true })
          .eq('restaurante_id', restauranteId!)
          .eq('status', 'aberta'),
      ])
      if (fechadasRes.error) throw fechadasRes.error
      if (abertasRes.error) throw abertasRes.error
      const faturamentoHoje = (fechadasRes.data ?? []).reduce((s, c: any) => s + (c.total ?? 0), 0)
      return { faturamentoHoje, comandasAbertas: abertasRes.count ?? 0 }
    },
  })
}

export default function AoVivoHoje({ restauranteId }: { restauranteId: string | null | undefined }) {
  const qc = useQueryClient()
  const { data } = useAoVivo(restauranteId)

  useEffect(() => {
    if (!restauranteId) return
    const supabase = createClient()
    const ch = supabase
      .channel('dashboard-aovivo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas' }, () => {
        qc.invalidateQueries({ queryKey: ['dashboard-aovivo', restauranteId] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itens_pedido' }, () => {
        qc.invalidateQueries({ queryKey: ['dashboard-aovivo', restauranteId] })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [restauranteId, qc])

  return (
    <div
      className="rounded-xl p-4 flex items-center justify-between"
      style={{ background: 'var(--primary)', color: '#FAF9F5' }}
    >
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#9FE0A0' }} aria-hidden />
        <span className="text-xs uppercase tracking-wider" style={{ opacity: 0.85 }}>Ao vivo · hoje</span>
      </div>
      <div className="flex items-center gap-5">
        <div className="text-right">
          <div className="text-xs" style={{ opacity: 0.8 }}>Faturamento</div>
          <div className="serif mono-num text-lg leading-none">{fmt.currency(data?.faturamentoHoje ?? 0)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs" style={{ opacity: 0.8 }}>Comandas abertas</div>
          <div className="serif mono-num text-lg leading-none">{data?.comandasAbertas ?? 0}</div>
        </div>
      </div>
    </div>
  )
}
