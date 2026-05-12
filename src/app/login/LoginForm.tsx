'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'
import Spinner from '@/components/Spinner'
import type { Role } from '@/types'

const DEFAULT_BY_ROLE: Record<Role, string> = {
  super_admin: '/super-admin',
  admin: '/admin',
  garcom: '/garcom',
  cozinha: '/cozinha',
}

export default function LoginForm() {
  const router = useRouter()
  const sp = useSearchParams()
  const forbidden = sp.get('forbidden') === '1'
  const nextPath = sp.get('next') || ''

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [focus, setFocus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(forbidden ? 'Acesso não autorizado para este usuário.' : '')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setErr('Preencha email e senha.'); return }
    setErr('')
    setBusy(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      const userId = data.user?.id
      if (!userId) throw new Error('Não foi possível obter o usuário.')

      const { data: perfil, error: e2 } = await supabase
        .from('perfis')
        .select('role')
        .eq('id', userId)
        .maybeSingle()
      if (e2) throw e2

      const role = perfil?.role as Role | undefined
      if (!role) {
        await supabase.auth.signOut()
        throw new Error('Seu perfil não foi configurado. Procure o administrador.')
      }

      const dest = nextPath || DEFAULT_BY_ROLE[role]
      router.replace(dest)
    } catch (e: any) {
      setErr(e.message || 'Credenciais inválidas.')
      setBusy(false)
    }
  }

  const inputStyle = (id: string): React.CSSProperties => ({
    width: '100%',
    padding: '12px 0',
    border: 'none',
    borderBottom: `1px solid ${focus === id ? 'var(--ink)' : 'var(--line)'}`,
    background: 'transparent',
    fontSize: 16,
    color: 'var(--ink)',
    transition: 'border-color 0.2s',
  })

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <div className="px-6 py-4">
        <Logo size="md" />
      </div>

      <form
        onSubmit={submit}
        className="flex-1 flex flex-col px-6 pt-10 pb-6 max-w-md mx-auto w-full"
      >
        <div className="mb-10 text-center">
          <Logo size="lg" />
          <div className="serif text-2xl mt-6" style={{ color: 'var(--ink)' }}>Entrar</div>
          <div className="text-sm mt-2" style={{ color: 'var(--text-mid)' }}>
            Acesso restrito à equipe da 637.
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-mid)' }}>Email</label>
            <input
              type="email"
              value={email}
              autoComplete="email"
              onFocus={() => setFocus('email')}
              onBlur={() => setFocus(null)}
              onChange={(e) => { setEmail(e.target.value); setErr('') }}
              placeholder="voce@637.com.br"
              style={inputStyle('email')}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-mid)' }}>Senha</label>
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              onFocus={() => setFocus('pwd')}
              onBlur={() => setFocus(null)}
              onChange={(e) => { setPassword(e.target.value); setErr('') }}
              placeholder="••••••••"
              style={inputStyle('pwd')}
            />
          </div>
        </div>

        {err && (
          <div className="mt-4 text-xs flex items-center gap-2" style={{ color: 'var(--accent)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 3l10 18H2L12 3z" />
              <path d="M12 10v5M12 18v.5" />
            </svg>
            {err}
          </div>
        )}

        <div className="mt-auto pt-10 safe-bottom">
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl flex items-center justify-center gap-2 text-base font-bold"
            style={{
              minHeight: 48,
              background: busy ? 'var(--accent-dk)' : 'var(--accent)',
              color: '#FAF9F5',
              border: 'none',
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            {busy ? <><Spinner /> Entrando</> : 'Entrar'}
          </button>
        </div>
      </form>
    </div>
  )
}
