'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'
import Spinner from '@/components/Spinner'
import { fmt, isCPFValid } from '@/lib/formatters'
import type { Mesa } from '@/types'

type Props = {
  mesa: Mesa
  onIdentified: (comandaId: string) => void
}

export default function IdentificacaoForm({ mesa, onIdentified }: Props) {
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [aceiteLgpd, setAceiteLgpd] = useState(false)
  const [focus, setFocus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const formValido = nome.trim().length > 0 && isCPFValid(cpf) && aceiteLgpd

  const submit = async () => {
    if (!nome.trim()) { setErr('Informe seu nome completo.'); return }
    if (!isCPFValid(cpf)) { setErr('CPF inválido.'); return }
    if (!aceiteLgpd) { setErr('Confirme o aceite da Política de Privacidade.'); return }
    setErr('')
    setBusy(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('comandas')
        .insert({
          mesa_id: mesa.id,
          restaurante_id: mesa.restaurante_id,
          cliente_nome: nome.trim(),
          cliente_cpf: cpf.replace(/\D/g, ''),
          status: 'aberta',
          aceite_lgpd_em: new Date().toISOString(),
        })
        .select('id')
        .single()
      if (error) throw error
      onIdentified(data.id)
    } catch (e: any) {
      setErr(e.message || 'Não foi possível abrir a comanda.')
      setBusy(false)
    }
  }

  const inputStyle = (id: string, valid: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '12px 0',
    border: 'none',
    borderBottom: `1px solid ${
      focus === id ? 'var(--ink)' : valid ? 'var(--primary)' : 'var(--line)'
    }`,
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

      <div className="flex-1 flex flex-col px-6 pt-8 pb-6">
        <div className="mb-10">
          <div className="serif text-2xl mb-2" style={{ color: 'var(--ink)', lineHeight: 1.1 }}>
            Bem-vindo
          </div>
          <div className="text-sm" style={{ color: 'var(--text-mid)' }}>
            Identifique-se para abrir sua comanda.
          </div>
        </div>

        <div
          className="inline-flex self-start items-center gap-2 px-3 py-2 rounded-xl mb-8"
          style={{ border: '1px solid var(--line)', color: 'var(--text-mid)', fontSize: 12 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 22s-7-7.5-7-13a7 7 0 1114 0c0 5.5-7 13-7 13z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          <span className="font-bold" style={{ color: 'var(--ink)' }}>{mesa.nome}</span>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-mid)' }}>
              Nome completo
            </label>
            <input
              value={nome}
              onFocus={() => setFocus('nome')}
              onBlur={() => setFocus(null)}
              onChange={(e) => { setNome(e.target.value); setErr('') }}
              placeholder="Seu nome"
              autoComplete="name"
              style={inputStyle('nome', nome.trim().length > 0)}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-mid)' }}>
              CPF
            </label>
            <input
              value={cpf}
              onFocus={() => setFocus('cpf')}
              onBlur={() => setFocus(null)}
              onChange={(e) => { setCpf(fmt.cpfMask(e.target.value)); setErr('') }}
              placeholder="000.000.000-00"
              inputMode="numeric"
              style={inputStyle('cpf', isCPFValid(cpf))}
            />
          </div>
        </div>

        <label className="flex items-start gap-3 mt-6 cursor-pointer">
          <input
            type="checkbox"
            checked={aceiteLgpd}
            onChange={(e) => { setAceiteLgpd(e.target.checked); setErr('') }}
            style={{ width: 20, height: 20, marginTop: 2, accentColor: 'var(--accent)' }}
          />
          <span className="text-sm" style={{ color: 'var(--text-mid)', lineHeight: 1.4 }}>
            Li e concordo com a{' '}
            <a
              href="/privacidade"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: 'var(--ink)' }}
            >
              Política de Privacidade
            </a>
            .
          </span>
        </label>

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
            onClick={submit}
            disabled={busy || !formValido}
            className="w-full rounded-xl flex items-center justify-center gap-2 text-base font-bold"
            style={{
              minHeight: 56,
              background: !formValido ? 'var(--line)' : busy ? 'var(--accent-dk)' : 'var(--accent)',
              color: !formValido ? 'var(--muted)' : '#FAF9F5',
              border: 'none',
              cursor: busy || !formValido ? 'default' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {busy ? <><Spinner /> Abrindo</> : 'Abrir minha comanda'}
          </button>
        </div>
      </div>
    </div>
  )
}
