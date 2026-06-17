'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import StaffHeader from '@/components/StaffHeader'
import Spinner from '@/components/Spinner'

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function NovoRestaurantePage() {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [slug, setSlug] = useState('')
  const [touchedSlug, setTouchedSlug] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [adminSenha, setAdminSenha] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState<{ slug: string } | null>(null)

  const handleNome = (v: string) => {
    setNome(v)
    if (!touchedSlug) setSlug(slugify(v))
  }

  const submit = async () => {
    setErr('')
    if (!nome.trim()) { setErr('Informe o nome do restaurante.'); return }
    if (!adminEmail.trim()) { setErr('Informe o email do admin.'); return }
    if (adminSenha.length < 8) { setErr('Senha deve ter ao menos 8 caracteres.'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/super-admin/restaurantes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          slug: slug.trim() || undefined,
          admin_email: adminEmail.trim(),
          admin_password: adminSenha,
          categorias_padrao: true,
        }),
      })
      // Parse defensivo: se a resposta vier sem JSON (ex.: 500 de plataforma), não quebra
      const raw = await res.text()
      const json = raw ? JSON.parse(raw) : {}
      if (!res.ok) throw new Error(json.error || `Erro ${res.status} ao criar restaurante.`)
      setOk({ slug: json.restaurante.slug })
    } catch (e: any) {
      setErr(e.message || 'Erro ao criar restaurante.')
    } finally {
      setBusy(false)
    }
  }

  if (ok) {
    return (
      <>
        <StaffHeader title="Pronto!" subtitle="Super Admin" />
        <div className="flex-1 px-6 py-8 max-w-md mx-auto w-full">
          <div className="serif text-xl mb-2" style={{ color: 'var(--ink)' }}>
            Restaurante criado
          </div>
          <p className="text-sm" style={{ color: 'var(--text-mid)' }}>
            O admin já pode entrar com o email e senha cadastrados.
          </p>
          <div
            className="mt-4 rounded-xl p-4 text-sm"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
          >
            <div className="mb-2"><strong>Slug:</strong> /{ok.slug}</div>
            <div><strong>Email do admin:</strong> {adminEmail}</div>
          </div>
          <div className="flex gap-2 mt-6">
            <button
              onClick={() => router.push('/super-admin')}
              className="flex-1 rounded-xl text-sm font-bold"
              style={{ minHeight: 48, background: 'var(--accent)', color: '#FAF9F5', border: 'none' }}
            >
              Voltar à lista
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <StaffHeader
        title="Novo restaurante"
        subtitle="Super Admin"
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
        <Field label="Nome do restaurante">
          <input
            value={nome}
            onChange={(e) => handleNome(e.target.value)}
            placeholder="Ex.: Boteco do Zé"
            className="w-full py-3 text-base"
            style={{ border: 'none', borderBottom: '1px solid var(--line)', background: 'transparent' }}
          />
        </Field>
        <Field label="Slug (URL)">
          <input
            value={slug}
            onChange={(e) => { setSlug(slugify(e.target.value)); setTouchedSlug(true) }}
            placeholder="boteco-do-ze"
            className="w-full py-3 text-base mono-num"
            style={{ border: 'none', borderBottom: '1px solid var(--line)', background: 'transparent' }}
          />
        </Field>

        <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--line)' }}>
          <div className="text-xs uppercase tracking-wider font-bold mb-3" style={{ color: 'var(--text-mid)' }}>
            Administrador do restaurante
          </div>
          <Field label="Email">
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@boteco.com.br"
              className="w-full py-3 text-base"
              style={{ border: 'none', borderBottom: '1px solid var(--line)', background: 'transparent' }}
            />
          </Field>
          <Field label="Senha temporária (mín. 8 caracteres)">
            <input
              type="text"
              value={adminSenha}
              onChange={(e) => setAdminSenha(e.target.value)}
              placeholder="••••••••"
              className="w-full py-3 text-base mono-num"
              style={{ border: 'none', borderBottom: '1px solid var(--line)', background: 'transparent' }}
            />
          </Field>
        </div>

        {err && (
          <div className="mt-4 text-xs" style={{ color: 'var(--accent)' }}>{err}</div>
        )}

        <div className="flex gap-2 mt-8">
          <Link
            href="/super-admin"
            className="flex-1 rounded-xl text-sm flex items-center justify-center"
            style={{ minHeight: 48, border: '1px solid var(--line)', color: 'var(--text-mid)' }}
          >
            Cancelar
          </Link>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ flex: 2, minHeight: 48, background: 'var(--accent)', color: '#FAF9F5', border: 'none' }}
          >
            {busy ? <><Spinner /> Criando</> : 'Criar restaurante'}
          </button>
        </div>
      </div>
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
