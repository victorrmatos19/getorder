'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import StaffHeader from '@/components/StaffHeader'
import EmptyState from '@/components/EmptyState'
import Spinner from '@/components/Spinner'
import Toast from '@/components/Toast'
import QRModal from './QRModal'
import { useMesas } from '@/lib/hooks/useMesas'
import { useRestaurante } from '@/lib/contexts/RestauranteContext'
import { fmt } from '@/lib/formatters'
import type { Mesa } from '@/types'

export default function MesasAdminPage() {
  const qc = useQueryClient()
  const { restauranteId } = useRestaurante()
  const { data: mesas = [], isLoading, isError, refetch } = useMesas(restauranteId)
  const [editing, setEditing] = useState<Mesa | null>(null)
  const [creating, setCreating] = useState(false)
  const [qrMesa, setQrMesa] = useState<Mesa | null>(null)
  const [toast, setToast] = useState({ visible: false, message: '' })

  const save = useMutation({
    mutationFn: async (input: { id?: string; nome: string; ativo: boolean }) => {
      const supabase = createClient()
      if (input.id) {
        const { error } = await supabase
          .from('mesas')
          .update({ nome: input.nome, ativo: input.ativo })
          .eq('id', input.id)
        if (error) throw error
      } else {
        if (!restauranteId) throw new Error('Restaurante não definido')
        const { error } = await supabase
          .from('mesas')
          .insert({ nome: input.nome, ativo: input.ativo, restaurante_id: restauranteId })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mesas'] })
      setEditing(null)
      setCreating(false)
      setToast({ visible: true, message: 'Mesa salva' })
    },
    onError: (e: any) => setToast({ visible: true, message: e.message || 'Erro ao salvar' }),
  })

  const toggleAtivo = useMutation({
    mutationFn: async (m: Mesa) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('mesas')
        .update({ ativo: !m.ativo })
        .eq('id', m.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mesas'] }),
  })

  return (
    <>
      <StaffHeader
        title="Mesas"
        subtitle="Admin"
        rightSlot={
          <button
            onClick={() => setCreating(true)}
            className="text-xs px-3 py-2 rounded-xl font-bold"
            style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none' }}
          >
            + Nova
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading && <div className="py-16 flex justify-center"><Spinner color="var(--accent)" /></div>}
        {isError && (
          <EmptyState
            icon="⚠️"
            title="Erro ao carregar"
            action={
              <button onClick={() => refetch()} className="text-sm underline" style={{ color: 'var(--accent)' }}>
                Tentar novamente
              </button>
            }
          />
        )}
        {!isLoading && mesas.length === 0 && (
          <EmptyState
            icon="🪑"
            title="Nenhuma mesa cadastrada"
            description="Comece criando sua primeira mesa."
          />
        )}
        <ul className="flex flex-col gap-2">
          {mesas.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{m.nome}</div>
                <div className="text-xs" style={{ color: 'var(--text-mid)' }}>
                  Criada em {fmt.date(m.criado_em)}
                </div>
              </div>
              <button
                onClick={() => toggleAtivo.mutate(m)}
                className="text-xs px-2 py-1 rounded-full"
                style={{
                  border: `1px solid ${m.ativo ? 'var(--status-ready)' : 'var(--muted)'}`,
                  color: m.ativo ? 'var(--status-ready)' : 'var(--muted)',
                }}
              >
                {m.ativo ? 'Ativa' : 'Inativa'}
              </button>
              <button
                onClick={() => setQrMesa(m)}
                className="text-xs px-3 py-2 rounded-xl"
                style={{ border: '1px solid var(--line)', color: 'var(--ink)' }}
              >
                QR
              </button>
              <button
                onClick={() => setEditing(m)}
                className="text-xs px-3 py-2 rounded-xl"
                style={{ border: '1px solid var(--line)', color: 'var(--text-mid)' }}
              >
                Editar
              </button>
            </li>
          ))}
        </ul>
      </div>

      {(creating || editing) && (
        <MesaForm
          initial={editing}
          onClose={() => { setEditing(null); setCreating(false) }}
          onSubmit={(d) => save.mutate({ id: editing?.id, ...d })}
          busy={save.isPending}
        />
      )}

      {qrMesa && (
        <QRModal mesa={qrMesa} onClose={() => setQrMesa(null)} />
      )}

      <Toast
        visible={toast.visible}
        message={toast.message}
        onClose={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </>
  )
}

function MesaForm({
  initial, onClose, onSubmit, busy,
}: {
  initial: Mesa | null
  onClose: () => void
  onSubmit: (d: { nome: string; ativo: boolean }) => void
  busy: boolean
}) {
  const [nome, setNome] = useState(initial?.nome ?? '')
  const [ativo, setAtivo] = useState(initial?.ativo ?? true)
  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={() => !busy && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full px-6 pt-6 pb-8 animate-slide-up safe-bottom"
        style={{ background: 'var(--bg)', borderRadius: '20px 20px 0 0' }}
      >
        <div className="serif text-xl mb-5" style={{ color: 'var(--ink)' }}>
          {initial ? 'Editar mesa' : 'Nova mesa'}
        </div>
        <label className="block text-xs mb-1" style={{ color: 'var(--text-mid)' }}>Nome</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Mesa 5 ou Quadra 1"
          className="w-full py-3 text-base"
          style={{
            border: 'none',
            borderBottom: '1px solid var(--line)',
            background: 'transparent',
            color: 'var(--ink)',
          }}
        />
        <label className="flex items-center gap-3 mt-5 text-sm">
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <span style={{ color: 'var(--ink)' }}>Mesa ativa (clientes podem abrir comandas)</span>
        </label>
        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-xl text-sm"
            style={{ minHeight: 48, border: '1px solid var(--line)', color: 'var(--text-mid)' }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onSubmit({ nome: nome.trim(), ativo })}
            disabled={busy || !nome.trim()}
            className="rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            style={{
              flex: 2,
              minHeight: 48,
              background: nome.trim() ? 'var(--accent)' : 'var(--line)',
              color: nome.trim() ? '#FAF9F5' : 'var(--muted)',
              border: 'none',
            }}
          >
            {busy ? <><Spinner /> Salvando</> : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
