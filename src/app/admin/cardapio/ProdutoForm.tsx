'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import Spinner from '@/components/Spinner'
import { useRestaurante } from '@/lib/contexts/RestauranteContext'
import { fmt } from '@/lib/formatters'
import { uid } from '@/lib/uid'
import ProdutoGruposSection from './ProdutoGruposSection'
import type { Categoria, Produto } from '@/types'

type Props = {
  initial: Produto | null
  defaultCategoriaId: string | null
  categorias: Categoria[]
  onClose: () => void
  onSaved: () => void
}

const MAX_BYTES = 2 * 1024 * 1024

export default function ProdutoForm({ initial, defaultCategoriaId, categorias, onClose, onSaved }: Props) {
  const { restauranteId } = useRestaurante()
  const [nome, setNome] = useState(initial?.nome ?? '')
  const [descricao, setDescricao] = useState(initial?.descricao ?? '')
  const [preco, setPreco] = useState(initial?.preco != null ? fmt.money(initial.preco) : '')
  const [categoriaId, setCategoriaId] = useState<string>(
    initial?.categoria_id ?? defaultCategoriaId ?? categorias[0]?.id ?? '',
  )
  const [ordem, setOrdem] = useState(initial?.ordem?.toString() ?? '0')
  const [disponivel, setDisponivel] = useState(initial?.disponivel ?? true)
  const [esgotado, setEsgotado] = useState(initial?.esgotado ?? false)
  const [emOferta, setEmOferta] = useState(initial?.em_oferta ?? false)
  const [ofertaPreco, setOfertaPreco] = useState(
    initial?.oferta_preco != null ? fmt.money(initial.oferta_preco) : '',
  )
  const [novidade, setNovidade] = useState(initial?.novidade ?? false)
  const [destaqueOrdem, setDestaqueOrdem] = useState(initial?.destaque_ordem?.toString() ?? '999')
  const [fotoUrl, setFotoUrl] = useState<string | null>(initial?.foto_url ?? null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(initial?.foto_url ?? null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const onFile = (f: File | null) => {
    setErr('')
    if (!f) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setErr('Formato inválido. Use JPG, PNG ou WebP.')
      return
    }
    if (f.size > MAX_BYTES) { setErr('Imagem maior que 2MB.'); return }
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const removeFoto = () => { setFile(null); setPreview(null); setFotoUrl(null) }

  const submit = async () => {
    if (!nome.trim())     { setErr('Informe o nome.'); return }
    if (!categoriaId)     { setErr('Escolha a categoria.'); return }
    const precoNum = fmt.moneyParse(preco)
    if (!Number.isFinite(precoNum) || precoNum <= 0) { setErr('Preço inválido.'); return }
    let ofertaNum: number | null = null
    if (emOferta) {
      ofertaNum = fmt.moneyParse(ofertaPreco)
      if (!Number.isFinite(ofertaNum) || ofertaNum <= 0) { setErr('Preço promocional inválido.'); return }
      if (ofertaNum >= precoNum) { setErr('Preço promocional deve ser menor que o preço normal.'); return }
    }
    const ordemNum = parseInt(ordem || '0', 10) || 0
    const destaqueNum = parseInt(destaqueOrdem || '999', 10) || 999

    setBusy(true)
    setErr('')
    try {
      const supabase = createClient()
      let foto_url = fotoUrl

      if (file) {
        if (!restauranteId) throw new Error('Restaurante não definido')
        const ext = file.name.split('.').pop() || 'jpg'
        // Foto fica na pasta do tenant: a policy de Storage exige <restaurante_id>/<arquivo>.
        const path = `${restauranteId}/${uid()}.${ext}`
        const { error: upErr } = await supabase
          .storage.from('produtos')
          .upload(path, file, { upsert: false, contentType: file.type })
        if (upErr) throw upErr
        const { data: pub } = supabase.storage.from('produtos').getPublicUrl(path)
        foto_url = pub.publicUrl
      }

      const cat = categorias.find((c) => c.id === categoriaId)
      const payload = {
        nome: nome.trim(),
        // descricao é NOT NULL DEFAULT '' no banco — enviar '' (não null) quando vazia
        descricao: descricao.trim(),
        preco: precoNum,
        categoria_id: categoriaId,
        // mantém coluna legada coerente com o nome em minúsculas (compat com /mesa antigo se houver)
        categoria: (cat?.nome ?? '').toLowerCase(),
        em_oferta: emOferta,
        oferta_preco: ofertaNum,
        novidade,
        destaque_ordem: destaqueNum,
        ordem: ordemNum,
        disponivel,
        esgotado,
        foto_url,
      }

      if (initial) {
        const { error } = await supabase.from('produtos').update(payload).eq('id', initial.id)
        if (error) throw error
      } else {
        if (!restauranteId) throw new Error('Restaurante não definido')
        const { error } = await supabase.from('produtos').insert({ ...payload, restaurante_id: restauranteId })
        if (error) throw error
      }

      onSaved()
    } catch (e: any) {
      setErr(e.message || 'Erro ao salvar.')
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={() => !busy && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full px-6 pt-6 pb-8 animate-slide-up safe-bottom max-h-[92vh] overflow-y-auto"
        style={{ background: 'var(--bg)', borderRadius: '20px 20px 0 0' }}
      >
        <div className="serif text-xl mb-5" style={{ color: 'var(--ink)' }}>
          {initial ? 'Editar produto' : 'Novo produto'}
        </div>

        {/* Foto */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
          >
            {preview ? (
              <Image src={preview} alt="" fill sizes="80px" className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl" aria-hidden>🍽️</div>
            )}
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <label
              className="rounded-xl text-xs font-bold text-center px-3 py-2 cursor-pointer"
              style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            >
              {preview ? 'Trocar foto' : 'Adicionar foto'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {preview && (
              <button
                onClick={removeFoto}
                className="rounded-xl text-xs px-3 py-2"
                style={{ border: '1px solid var(--line)', color: 'var(--accent)' }}
              >
                Remover foto
              </button>
            )}
            <div className="text-xs" style={{ color: 'var(--muted)' }}>JPG/PNG/WebP até 2MB</div>
          </div>
        </div>

        <Field label="Nome">
          <input
            value={nome}
            onChange={(e) => { setNome(e.target.value); setErr('') }}
            placeholder="Nome do produto"
            className="w-full py-3 text-base"
            style={{ border: 'none', borderBottom: '1px solid var(--line)', background: 'transparent', color: 'var(--ink)' }}
          />
        </Field>

        <Field label="Descrição">
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhes curtos"
            className="w-full py-3 text-base"
            style={{ border: 'none', borderBottom: '1px solid var(--line)', background: 'transparent', color: 'var(--ink)' }}
          />
        </Field>

        <Field label="Categoria">
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="w-full py-3 text-base"
            style={{ border: 'none', borderBottom: '1px solid var(--line)', background: 'transparent', color: 'var(--ink)' }}
          >
            {categorias.length === 0 && <option value="">— sem categorias —</option>}
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji ? `${c.emoji} ` : ''}{c.nome}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Preço (R$)">
            <input
              value={preco}
              onChange={(e) => setPreco(fmt.moneyMask(e.target.value))}
              placeholder="0,00"
              inputMode="numeric"
              className="w-full py-3 text-base mono-num"
              style={{ border: 'none', borderBottom: '1px solid var(--line)', background: 'transparent', color: 'var(--ink)' }}
            />
          </Field>
          <Field label="Ordem">
            <input
              value={ordem}
              onChange={(e) => setOrdem(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="0"
              inputMode="numeric"
              className="w-full py-3 text-base mono-num"
              style={{ border: 'none', borderBottom: '1px solid var(--line)', background: 'transparent', color: 'var(--ink)' }}
            />
          </Field>
        </div>

        {/* Destaques */}
        <div
          className="mt-4 rounded-xl p-3"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
        >
          <div className="text-xs uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--text-mid)' }}>
            Destaque
          </div>
          <label className="flex items-center gap-3 py-1 text-sm">
            <input
              type="checkbox"
              checked={novidade}
              onChange={(e) => setNovidade(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <span style={{ color: 'var(--ink)' }}>🆕 Marcar como novidade</span>
          </label>
          <label className="flex items-center gap-3 py-1 text-sm">
            <input
              type="checkbox"
              checked={emOferta}
              onChange={(e) => setEmOferta(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <span style={{ color: 'var(--ink)' }}>🔥 Em oferta</span>
          </label>

          {emOferta && (
            <div className="mt-3">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-mid)' }}>Preço promocional (R$)</label>
              <input
                value={ofertaPreco}
                onChange={(e) => setOfertaPreco(fmt.moneyMask(e.target.value))}
                placeholder="0,00"
                inputMode="numeric"
                className="w-full py-2 text-base mono-num"
                style={{ border: 'none', borderBottom: '1px solid var(--line)', background: 'transparent', color: 'var(--ink)' }}
              />
            </div>
          )}

          {(emOferta || novidade) && (
            <div className="mt-3">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-mid)' }}>
                Ordem do destaque (menor = mais acima)
              </label>
              <input
                value={destaqueOrdem}
                onChange={(e) => setDestaqueOrdem(e.target.value.replace(/[^0-9]/g, ''))}
                inputMode="numeric"
                className="w-full py-2 text-base mono-num"
                style={{ border: 'none', borderBottom: '1px solid var(--line)', background: 'transparent', color: 'var(--ink)' }}
              />
            </div>
          )}
        </div>

        <label className="flex items-center gap-3 mt-3 text-sm">
          <input
            type="checkbox"
            checked={disponivel}
            onChange={(e) => setDisponivel(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <span style={{ color: 'var(--ink)' }}>Disponível para venda</span>
        </label>

        <label className="flex items-center gap-3 mt-3 text-sm">
          <input
            type="checkbox"
            checked={esgotado}
            onChange={(e) => setEsgotado(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <span style={{ color: 'var(--ink)' }}>
            Esgotado (sem estoque hoje)
            <span className="block text-xs" style={{ color: 'var(--text-mid)' }}>
              Continua no cardápio, riscado, sem poder pedir
            </span>
          </span>
        </label>

        <ProdutoGruposSection produtoId={initial?.id} restauranteId={restauranteId} />

        {err && (
          <div className="mt-4 text-xs" style={{ color: 'var(--accent)' }}>{err}</div>
        )}

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
            onClick={submit}
            disabled={busy}
            className="rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ flex: 2, minHeight: 48, background: 'var(--accent)', color: '#FAF9F5', border: 'none' }}
          >
            {busy ? <><Spinner /> Salvando</> : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
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
