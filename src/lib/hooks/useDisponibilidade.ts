'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { HorarioFuncionamento, Restaurante } from '@/types'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export type Disponibilidade = {
  podeReceber: boolean
  motivo: 'pausa' | 'fora_horario' | null
  mensagem: string | null
  horarioHoje: HorarioFuncionamento | null
  restaurante: Restaurante | null
}

function parseTime(t: string | null): { h: number; m: number } | null {
  if (!t) return null
  const [h, m] = t.split(':').map((n) => parseInt(n, 10))
  if (!Number.isFinite(h)) return null
  return { h, m: m || 0 }
}

function compareTime(now: Date, t: { h: number; m: number }) {
  const a = now.getHours() * 60 + now.getMinutes()
  const b = t.h * 60 + t.m
  return a - b
}

export function useDisponibilidade(restauranteId: string | null | undefined) {
  const supabase = createClient()
  return useQuery({
    queryKey: ['disponibilidade', restauranteId],
    enabled: !!restauranteId,
    refetchInterval: 60_000,
    queryFn: async (): Promise<Disponibilidade> => {
      const { data: rest, error: e1 } = await supabase
        .from('restaurantes')
        .select('*')
        .eq('id', restauranteId!)
        .maybeSingle()
      if (e1) throw e1
      if (!rest) {
        return { podeReceber: false, motivo: null, mensagem: 'Restaurante indisponível.', horarioHoje: null, restaurante: null }
      }
      const restaurante = rest as Restaurante

      if (restaurante.pedidos_pausados) {
        return {
          podeReceber: false,
          motivo: 'pausa',
          mensagem: restaurante.pausa_mensagem ?? 'Estamos com a cozinha cheia, voltamos em alguns minutos.',
          horarioHoje: null,
          restaurante,
        }
      }

      const now = new Date()
      const dia = now.getDay()

      const { data: hs } = await supabase
        .from('horarios_funcionamento')
        .select('*')
        .eq('restaurante_id', restauranteId!)
        .eq('dia_semana', dia)
        .maybeSingle()

      const horarioHoje = (hs ?? null) as HorarioFuncionamento | null

      if (!horarioHoje || horarioHoje.fechado) {
        return {
          podeReceber: false,
          motivo: 'fora_horario',
          mensagem: `Fechado ${DIAS[dia].toLowerCase()}`,
          horarioHoje,
          restaurante,
        }
      }

      const abre = parseTime(horarioHoje.abre)
      const fecha = parseTime(horarioHoje.fecha)

      if (!abre || !fecha) {
        return {
          podeReceber: true,
          motivo: null,
          mensagem: null,
          horarioHoje,
          restaurante,
        }
      }

      if (compareTime(now, abre) < 0 || compareTime(now, fecha) > 0) {
        const abreStr  = `${String(abre.h).padStart(2, '0')}:${String(abre.m).padStart(2, '0')}`
        const fechaStr = `${String(fecha.h).padStart(2, '0')}:${String(fecha.m).padStart(2, '0')}`
        return {
          podeReceber: false,
          motivo: 'fora_horario',
          mensagem: `Atendemos hoje das ${abreStr} às ${fechaStr}.`,
          horarioHoje,
          restaurante,
        }
      }

      return { podeReceber: true, motivo: null, mensagem: null, horarioHoje, restaurante }
    },
  })
}
