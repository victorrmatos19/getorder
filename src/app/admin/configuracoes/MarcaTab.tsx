'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import Spinner from '@/components/Spinner'
import Toast from '@/components/Toast'
import ThemeScope from '@/components/ThemeScope'
import { useRestaurante } from '@/lib/contexts/RestauranteContext'
import { DEFAULT_PRIMARY, DEFAULT_ACCENT } from '@/lib/theme'
import { uid } from '@/lib/uid'
import type { Restaurante } from '@/types'

const MAX_BYTES = 1024 * 1024 // 1 MB
const HEX = /^#[0-9a-fA-F]{6}$/

export default function MarcaTab() {
  const qc = useQueryClient()
  const { restauranteId } = useRestaurante()
  const [rest, setRest] = useState<Restaurante | null>(null)
  const [nome, setNome] = useState('')
  const [primaria, setPrimaria] = useState('') // '' = usar padrão GetOrder
  const [accent, setAccent] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
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
          setNome(r.nome)
          setPrimaria(r.cor_primaria ?? '')
          setAccent(r.cor_accent ?? '')
          setLogoUrl(r.logo_url)
          setPreview(r.logo_url)
        }
        setLoading(false)
      })
  }, [restauranteId])

  const onFile = (f: File | null) => {
    setErr('')
    if (!f) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) {
      setErr('Formato inválido. Use PNG, JPG ou WebP.')
      return
    }
    if (f.size > MAX_BYTES) { setErr('Logo maior que 1MB.'); return }
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const removeLogo = () => { setFile(null); setPreview(null); setLogoUrl(null) }
  const usarPadrao = () => { setPrimaria(''); setAccent(''); setErr('') }

  const save = async () => {
    if (!rest || !restauranteId) return
    if (primaria && !HEX.test(primaria)) { setErr('Cor primária inválida (use #RRGGBB).'); return }
    if (accent && !HEX.test(accent)) { setErr('Cor de destaque inválida (use #RRGGBB).'); return }
    setBusy(true)
    setErr('')
    try {
      const supabase = createClient()
      let foto = logoUrl
      if (file) {
        const ext = file.name.split('.').pop() || 'png'
        // Pasta do tenant: a policy de Storage exige <restaurante_id>/<arquivo>.
        const path = `${restauranteId}/${uid()}.${ext}`
        const { error: upErr } = await supabase
          .storage.from('logos')
          .upload(path, file, { upsert: false, contentType: file.type })
        if (upErr) throw upErr
        const { data: pub } = supabase.storage.from('logos').getPublicUrl(path)
        foto = pub.publicUrl
      }

      const { error } = await supabase
        .from('restaurantes')
        .update({
          cor_primaria: primaria || null,
          cor_accent: accent || null,
          logo_url: foto,
        })
        .eq('id', restauranteId)
      if (error) throw error

      setLogoUrl(foto)
      setFile(null)
      qc.invalidateQueries({ queryKey: ['disponibilidade'] })
      setToast({ visible: true, message: 'Marca salva' })
    } catch (e: any) {
      setToast({ visible: true, message: e.message || 'Erro ao salvar' })
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="py-16 flex justify-center"><Spinner color="var(--accent)" /></div>
  }

  const previewPrimaria = primaria || null
  const previewAccent = accent || null

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 max-w-md w-full">
      {/* Logo */}
      <Section title="Logo">
        <div className="flex items-center gap-3">
          <div
            className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            ) : (
              <span className="text-3xl" aria-hidden>🏷️</span>
            )}
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <label
              className="rounded-xl text-xs font-bold text-center px-3 py-2 cursor-pointer"
              style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            >
              {preview ? 'Trocar logo' : 'Adicionar logo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {preview && (
              <button
                onClick={removeLogo}
                className="rounded-xl text-xs px-3 py-2"
                style={{ border: '1px solid var(--line)', color: 'var(--accent)' }}
              >
                Remover logo
              </button>
            )}
            <div className="text-xs" style={{ color: 'var(--muted)' }}>PNG/JPG/WebP até 1MB</div>
          </div>
        </div>
      </Section>

      {/* Cores */}
      <Section title="Cores da marca">
        <ColorField
          label="Cor primária"
          value={primaria}
          fallback={DEFAULT_PRIMARY}
          onChange={(v) => { setPrimaria(v); setErr('') }}
        />
        <div className="mt-4">
          <ColorField
            label="Cor de destaque (botões, preços)"
            value={accent}
            fallback={DEFAULT_ACCENT}
            onChange={(v) => { setAccent(v); setErr('') }}
          />
        </div>
        {(primaria || accent) && (
          <button
            onClick={usarPadrao}
            className="mt-4 text-xs underline"
            style={{ color: 'var(--text-mid)' }}
          >
            Usar cores padrão GetOrder
          </button>
        )}
      </Section>

      {/* Preview ao vivo */}
      <Section title="Pré-visualização">
        <div className="text-xs mb-2" style={{ color: 'var(--text-mid)' }}>Cardápio do cliente</div>
        <ThemeScope
          primaria={previewPrimaria}
          accent={previewAccent}
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--line)' }}
        >
          <div className="p-3" style={{ background: 'var(--bg)' }}>
            <div className="flex items-center gap-2 mb-3">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" style={{ height: 22, width: 'auto', maxWidth: 110, objectFit: 'contain' }} />
              ) : (
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{nome || 'Seu restaurante'}</span>
              )}
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>via GetOrder</span>
            </div>
            <div className="rounded-xl p-3 mb-3" style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
              <div style={{ color: 'var(--ink)', fontWeight: 600 }}>Produto exemplo</div>
              <div className="mono-num" style={{ color: 'var(--accent)', fontWeight: 700 }}>R$ 18,00</div>
            </div>
            <button
              className="w-full rounded-lg text-sm font-bold"
              style={{ minHeight: 44, background: 'var(--accent)', color: 'var(--on-accent)', border: 'none' }}
            >
              Adicionar ao pedido
            </button>
          </div>
        </ThemeScope>

        <div className="text-xs mt-4 mb-2" style={{ color: 'var(--text-mid)' }}>Cozinha (tema escuro)</div>
        <ThemeScope
          primaria={previewPrimaria}
          accent={previewAccent}
          dark
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--line)' }}
        >
          <div className="p-3" style={{ background: 'var(--primary-dk)', color: '#F2F0E8' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Mesa 5</div>
            <div className="rounded-xl p-3" style={{ background: '#242821', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 13, opacity: 0.85 }}>1× Produto exemplo</div>
              <button
                className="mt-2 rounded-lg text-xs font-bold"
                style={{ minHeight: 36, padding: '0 12px', background: 'var(--accent)', color: 'var(--on-accent)', border: 'none' }}
              >
                Pronto
              </button>
            </div>
          </div>
        </ThemeScope>
      </Section>

      {err && <div className="text-xs mb-3" style={{ color: 'var(--accent)' }}>{err}</div>}

      <button
        onClick={save}
        disabled={busy}
        className="w-full rounded-xl text-sm font-bold flex items-center justify-center gap-2"
        style={{ minHeight: 48, background: 'var(--accent)', color: 'var(--on-accent)', border: 'none' }}
      >
        {busy ? <><Spinner /> Salvando</> : 'Salvar marca'}
      </button>

      <Toast
        visible={toast.visible}
        message={toast.message}
        onClose={() => setToast((t) => ({ ...t, visible: false }))}
      />
    </div>
  )
}

function ColorField({
  label, value, fallback, onChange,
}: {
  label: string
  value: string
  fallback: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: 'var(--text-mid)' }}>{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value || fallback}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          style={{ width: 44, height: 44, border: '1px solid var(--line)', borderRadius: 8, background: 'transparent', padding: 2, cursor: 'pointer' }}
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder={`${fallback} (padrão)`}
          className="flex-1 py-3 text-base mono-num"
          style={{ border: 'none', borderBottom: '1px solid var(--line)', background: 'transparent', color: 'var(--ink)' }}
        />
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-xl p-4 mb-4"
      style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
    >
      <div className="text-xs uppercase tracking-wider font-bold mb-3" style={{ color: 'var(--text-mid)' }}>
        {title}
      </div>
      {children}
    </section>
  )
}
