'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Spinner from '@/components/Spinner'
import Toast from '@/components/Toast'
import { useRestaurante } from '@/lib/contexts/RestauranteContext'
import type { HorarioFuncionamento } from '@/types'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

type Row = {
  dia_semana: number
  abre: string
  fecha: string
  fechado: boolean
  id?: string
}

function ensureSeven(rows: HorarioFuncionamento[]): Row[] {
  const map = new Map<number, HorarioFuncionamento>()
  rows.forEach((r) => map.set(r.dia_semana, r))
  return Array.from({ length: 7 }, (_, dia) => {
    const r = map.get(dia)
    return {
      id: r?.id,
      dia_semana: dia,
      abre: (r?.abre ?? '17:00').slice(0, 5),
      fecha: (r?.fecha ?? '23:00').slice(0, 5),
      fechado: r?.fechado ?? false,
    }
  })
}

export default function HorarioTab() {
  const { restauranteId } = useRestaurante()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState({ visible: false, message: '' })

  useEffect(() => {
    if (!restauranteId) return
    const supabase = createClient()
    supabase
      .from('horarios_funcionamento')
      .select('*')
      .eq('restaurante_id', restauranteId)
      .then(({ data }) => {
        setRows(ensureSeven((data ?? []) as HorarioFuncionamento[]))
        setLoading(false)
      })
  }, [restauranteId])

  const update = (dia: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.dia_semana === dia ? { ...r, ...patch } : r)))
  }

  const save = async () => {
    if (!restauranteId) return
    setBusy(true)
    try {
      const supabase = createClient()
      const payload = rows.map((r) => ({
        restaurante_id: restauranteId,
        dia_semana: r.dia_semana,
        abre: r.fechado ? null : `${r.abre}:00`,
        fecha: r.fechado ? null : `${r.fecha}:00`,
        fechado: r.fechado,
      }))
      const { error } = await supabase
        .from('horarios_funcionamento')
        .upsert(payload, { onConflict: 'restaurante_id,dia_semana' })
      if (error) throw error
      setToast({ visible: true, message: 'Horários salvos' })
    } catch (e: any) {
      setToast({ visible: true, message: e.message || 'Erro ao salvar' })
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="py-16 flex justify-center"><Spinner color="var(--accent)" /></div>
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 max-w-md w-full">
      <div
        className="text-xs uppercase tracking-wider font-bold mb-3"
        style={{ color: 'var(--text-mid)' }}
      >
        Horário de funcionamento
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li
            key={r.dia_semana}
            className="rounded-xl p-3 flex items-center gap-3 flex-wrap"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
          >
            <div className="w-20 text-sm font-bold" style={{ color: 'var(--ink)' }}>
              {DIAS[r.dia_semana]}
            </div>
            <input
              type="time"
              value={r.abre}
              disabled={r.fechado}
              onChange={(e) => update(r.dia_semana, { abre: e.target.value })}
              className="rounded-lg px-2 py-2 mono-num text-sm"
              style={{
                border: '1px solid var(--line)',
                background: 'var(--bg)',
                color: r.fechado ? 'var(--muted)' : 'var(--ink)',
                opacity: r.fechado ? 0.5 : 1,
              }}
            />
            <span className="text-xs" style={{ color: 'var(--text-mid)' }}>às</span>
            <input
              type="time"
              value={r.fecha}
              disabled={r.fechado}
              onChange={(e) => update(r.dia_semana, { fecha: e.target.value })}
              className="rounded-lg px-2 py-2 mono-num text-sm"
              style={{
                border: '1px solid var(--line)',
                background: 'var(--bg)',
                color: r.fechado ? 'var(--muted)' : 'var(--ink)',
                opacity: r.fechado ? 0.5 : 1,
              }}
            />
            <label className="ml-auto flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={r.fechado}
                onChange={(e) => update(r.dia_semana, { fechado: e.target.checked })}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ color: 'var(--text-mid)' }}>Fechado</span>
            </label>
          </li>
        ))}
      </ul>

      <button
        onClick={save}
        disabled={busy}
        className="w-full rounded-xl text-sm font-bold flex items-center justify-center gap-2 mt-6"
        style={{ minHeight: 48, background: 'var(--accent)', color: '#FAF9F5', border: 'none' }}
      >
        {busy ? <><Spinner /> Salvando</> : 'Salvar horários'}
      </button>

      <Toast
        visible={toast.visible}
        message={toast.message}
        onClose={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </div>
  )
}
