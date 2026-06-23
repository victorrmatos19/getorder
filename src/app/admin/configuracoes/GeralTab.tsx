'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import Spinner from '@/components/Spinner'
import Toast from '@/components/Toast'
import { useRestaurante } from '@/lib/contexts/RestauranteContext'
import type { Restaurante } from '@/types'

export default function GeralTab() {
  const qc = useQueryClient()
  const { restauranteId } = useRestaurante()
  const [rest, setRest] = useState<Restaurante | null>(null)
  const [taxaPct, setTaxaPct] = useState('10')
  const [taxaObrigatoria, setTaxaObrigatoria] = useState(false)
  const [pausado, setPausado] = useState(false)
  const [pausaMsg, setPausaMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState({ visible: false, message: '' })

  useEffect(() => {
    if (!restauranteId) return
    const supabase = createClient()
    supabase
      .from('restaurantes')
      .select('*')
      .eq('id', restauranteId)
      .maybeSingle()
      .then(({ data }) => {
        const r = data as Restaurante | null
        setRest(r)
        if (r) {
          setTaxaPct(String(r.taxa_servico_percentual ?? 10).replace('.', ','))
          setTaxaObrigatoria(r.taxa_servico_obrigatoria)
          setPausado(r.pedidos_pausados)
          setPausaMsg(r.pausa_mensagem ?? '')
        }
        setLoading(false)
      })
  }, [restauranteId])

  const save = async () => {
    if (!rest) return
    const taxaNum = parseFloat(taxaPct.replace(',', '.'))
    if (!Number.isFinite(taxaNum) || taxaNum < 0 || taxaNum > 100) {
      setToast({ visible: true, message: 'Taxa inválida (0–100%).' })
      return
    }
    setBusy(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('restaurantes')
        .update({
          taxa_servico_percentual: taxaNum,
          taxa_servico_obrigatoria: taxaObrigatoria,
          pedidos_pausados: pausado,
          pausa_mensagem: pausaMsg.trim() || null,
        })
        .eq('id', rest.id)
      if (error) throw error
      qc.invalidateQueries({ queryKey: ['disponibilidade'] })
      setToast({ visible: true, message: 'Configurações salvas' })
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
      <Section title="Taxa de serviço">
        <Field label="Percentual (%)">
          <input
            value={taxaPct}
            onChange={(e) => setTaxaPct(e.target.value.replace(/[^0-9,.]/g, ''))}
            inputMode="decimal"
            placeholder="10"
            className="w-full py-3 text-base mono-num"
            style={{ border: 'none', borderBottom: '1px solid var(--line)', background: 'transparent' }}
          />
        </Field>
        <label className="flex items-center gap-3 mt-4 text-sm">
          <input
            type="checkbox"
            checked={taxaObrigatoria}
            onChange={(e) => setTaxaObrigatoria(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <span style={{ color: 'var(--ink)' }}>
            Obrigatória — garçom não pode remover no fechamento
          </span>
        </label>
      </Section>

      <Section title="Pausar novos pedidos">
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={pausado}
            onChange={(e) => setPausado(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <span style={{ color: 'var(--ink)' }}>Pausar novos pedidos temporariamente</span>
        </label>
        {pausado && (
          <div className="mt-3 animate-fade-in">
            <label className="block text-xs mb-1" style={{ color: 'var(--text-mid)' }}>
              Mensagem ao cliente
            </label>
            <textarea
              value={pausaMsg}
              onChange={(e) => setPausaMsg(e.target.value)}
              rows={3}
              maxLength={200}
              placeholder="Estamos com a cozinha cheia, voltamos em alguns minutos"
              className="w-full text-sm"
              style={{
                padding: 12,
                borderRadius: 12,
                border: '1px solid var(--line)',
                background: 'var(--bg)',
                color: 'var(--ink)',
                resize: 'none',
              }}
            />
          </div>
        )}
      </Section>

      <button
        onClick={save}
        disabled={busy}
        className="w-full rounded-xl text-sm font-bold flex items-center justify-center gap-2 mt-4"
        style={{ minHeight: 48, background: 'var(--accent)', color: 'var(--on-accent)', border: 'none' }}
      >
        {busy ? <><Spinner /> Salvando</> : 'Salvar alterações'}
      </button>

      <Toast
        visible={toast.visible}
        message={toast.message}
        onClose={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-xl p-4 mb-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
    >
      <div
        className="text-xs uppercase tracking-wider font-bold mb-3"
        style={{ color: 'var(--text-mid)' }}
      >
        {title}
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: 'var(--text-mid)' }}>{label}</label>
      {children}
    </div>
  )
}
