'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StaffHeader from '@/components/StaffHeader'
import Spinner from '@/components/Spinner'
import Toast from '@/components/Toast'
import type { Restaurante } from '@/types'

type Perfil = { id: string; role: string }

export default function RestauranteDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const [rest, setRest] = useState<Restaurante | null>(null)
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [loading, setLoading] = useState(true)
  const [nome, setNome] = useState('')
  const [slug, setSlug] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState({ visible: false, message: '' })

  useEffect(() => {
    const supabase = createClient()
    const load = async () => {
      const { data: r } = await supabase.from('restaurantes').select('*').eq('id', id).maybeSingle()
      if (r) {
        setRest(r as Restaurante)
        setNome(r.nome)
        setSlug(r.slug)
        setAtivo(r.ativo)
      }
      const { data: ps } = await supabase
        .from('perfis')
        .select('id, role')
        .eq('restaurante_id', id)
      setPerfis((ps ?? []) as Perfil[])
      setLoading(false)
    }
    load()
  }, [id])

  const save = async () => {
    if (!rest) return
    setBusy(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('restaurantes')
        .update({ nome, slug, ativo })
        .eq('id', rest.id)
      if (error) throw error
      setToast({ visible: true, message: 'Restaurante atualizado' })
    } catch (e: any) {
      setToast({ visible: true, message: e.message || 'Erro ao salvar' })
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner color="var(--accent)" />
      </div>
    )
  }

  if (!rest) {
    return (
      <div className="px-6 py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>
        Restaurante não encontrado.{' '}
        <Link href="/super-admin" className="underline" style={{ color: 'var(--accent)' }}>Voltar</Link>
      </div>
    )
  }

  return (
    <>
      <StaffHeader
        title={rest.nome}
        subtitle={`Super Admin · /${rest.slug}`}
        leftSlot={
          <Link
            href="/super-admin"
            className="w-9 h-9 rounded-xl flex items-center justify-center mr-2"
            style={{ border: '1px solid var(--line)', color: 'var(--ink)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-6 max-w-md mx-auto w-full">
        <Field label="Nome">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full py-3 text-base"
            style={{ border: 'none', borderBottom: '1px solid var(--line)', background: 'transparent' }}
          />
        </Field>
        <Field label="Slug">
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full py-3 text-base mono-num"
            style={{ border: 'none', borderBottom: '1px solid var(--line)', background: 'transparent' }}
          />
        </Field>

        <label className="flex items-center gap-3 mt-5 text-sm">
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <span style={{ color: 'var(--ink)' }}>Restaurante ativo</span>
        </label>

        <div className="flex gap-2 mt-6">
          <Link
            href="/super-admin"
            className="flex-1 rounded-xl text-sm flex items-center justify-center"
            style={{ minHeight: 48, border: '1px solid var(--line)', color: 'var(--text-mid)' }}
          >
            Voltar
          </Link>
          <button
            onClick={save}
            disabled={busy}
            className="rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ flex: 2, minHeight: 48, background: 'var(--accent)', color: '#FAF9F5', border: 'none' }}
          >
            {busy ? <><Spinner /> Salvando</> : 'Salvar alterações'}
          </button>
        </div>

        <div className="mt-10">
          <div className="text-xs uppercase tracking-wider font-bold mb-3" style={{ color: 'var(--text-mid)' }}>
            Usuários vinculados ({perfis.length})
          </div>
          {perfis.length === 0 ? (
            <div className="text-sm" style={{ color: 'var(--muted)' }}>Sem usuários cadastrados.</div>
          ) : (
            <ul className="flex flex-col gap-2">
              {perfis.map((p) => (
                <li
                  key={p.id}
                  className="rounded-xl px-3 py-2 flex items-center justify-between"
                  style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
                >
                  <span className="mono-num text-xs truncate" style={{ color: 'var(--text-mid)' }}>{p.id}</span>
                  <span className="text-xs font-bold" style={{ color: 'var(--ink)' }}>{p.role}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Toast
        visible={toast.visible}
        message={toast.message}
        onClose={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <label className="block text-xs mb-1" style={{ color: 'var(--text-mid)' }}>{label}</label>
      {children}
    </div>
  )
}
