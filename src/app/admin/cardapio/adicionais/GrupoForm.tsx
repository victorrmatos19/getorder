'use client'

import { useState } from 'react'
import Spinner from '@/components/Spinner'
import { fmt } from '@/lib/formatters'
import { uid } from '@/lib/uid'
import type { GrupoAdicional, SelecaoAdicional } from '@/types'
import type { SalvarGrupoInput, OpcaoInput } from '@/lib/hooks/useAdicionais'

type OpcaoRow = {
  key: string
  id?: string
  nome: string
  preco: string      // string p/ máscara; '' = 0
  disponivel: boolean
  ordem: string
}

type Props = {
  initial: GrupoAdicional | null
  onClose: () => void
  onSubmit: (input: SalvarGrupoInput) => Promise<void>
  busy: boolean
}

function novaOpcao(ordem: number): OpcaoRow {
  return { key: uid(), nome: '', preco: '', disponivel: true, ordem: String(ordem) }
}

export default function GrupoForm({ initial, onSubmit, onClose, busy }: Props) {
  const [nome, setNome] = useState(initial?.nome ?? '')
  const [selecao, setSelecao] = useState<SelecaoAdicional>(initial?.selecao ?? 'unica')
  const [obrigatorio, setObrigatorio] = useState(initial?.obrigatorio ?? false)
  const [minEscolhas, setMinEscolhas] = useState<number>(initial?.min_escolhas ?? 0)
  const [semTeto, setSemTeto] = useState<boolean>(initial ? initial.max_escolhas == null : true)
  const [maxEscolhas, setMaxEscolhas] = useState<number>(initial?.max_escolhas ?? 1)
  const [ativo, setAtivo] = useState(initial?.ativo ?? true)

  const [opcoes, setOpcoes] = useState<OpcaoRow[]>(
    (initial?.adicionais ?? []).map((a) => ({
      key: a.id,
      id: a.id,
      nome: a.nome,
      preco: a.preco ? fmt.money(a.preco) : '',
      disponivel: a.disponivel,
      ordem: String(a.ordem),
    })),
  )
  const [removidas, setRemovidas] = useState<string[]>([])
  const [err, setErr] = useState('')

  const isUnica = selecao === 'unica'

  const setOpcao = (key: string, patch: Partial<OpcaoRow>) =>
    setOpcoes((list) => list.map((o) => (o.key === key ? { ...o, ...patch } : o)))

  const addOpcao = () =>
    setOpcoes((list) => [...list, novaOpcao(list.length)])

  const removeOpcao = (row: OpcaoRow) => {
    if (row.id) setRemovidas((r) => [...r, row.id!])
    setOpcoes((list) => list.filter((o) => o.key !== row.key))
  }

  const submit = async () => {
    setErr('')
    if (!nome.trim()) { setErr('Informe o nome do grupo.'); return }

    const limpas = opcoes.filter((o) => o.nome.trim())
    if (limpas.length === 0) { setErr('Adicione ao menos uma opção.'); return }

    // Regras de min/max conforme o tipo de seleção
    let min: number
    let max: number | null
    if (isUnica) {
      min = obrigatorio ? 1 : 0
      max = 1
    } else {
      min = Math.max(0, minEscolhas)
      if (obrigatorio && min < 1) min = 1
      max = semTeto ? null : Math.max(1, maxEscolhas)
      if (max != null && max < min) { setErr('O máximo deve ser maior ou igual ao mínimo.'); return }
    }

    // Monta as opções
    const opcoesInput: OpcaoInput[] = []
    for (const o of limpas) {
      const precoNum = fmt.moneyParse(o.preco)
      if (!Number.isFinite(precoNum) || precoNum < 0) {
        setErr(`Preço inválido em "${o.nome.trim()}".`); return
      }
      opcoesInput.push({
        id: o.id,
        nome: o.nome.trim(),
        preco: precoNum,
        disponivel: o.disponivel,
        ordem: parseInt(o.ordem || '0', 10) || 0,
      })
    }

    try {
      await onSubmit({
        id: initial?.id,
        nome: nome.trim(),
        selecao,
        obrigatorio,
        min_escolhas: min,
        max_escolhas: max,
        ativo,
        opcoes: opcoesInput,
        opcoesRemovidas: removidas,
      })
    } catch (e: any) {
      setErr(e.message || 'Erro ao salvar.')
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
          {initial ? 'Editar grupo' : 'Novo grupo'}
        </div>

        <Field label="Nome do grupo">
          <input
            value={nome}
            onChange={(e) => { setNome(e.target.value); setErr('') }}
            placeholder="Ex.: Ponto da carne, Adicionais"
            className="w-full py-3 text-base"
            style={inputStyle}
          />
        </Field>

        {/* Tipo de seleção */}
        <div className="mt-4">
          <label className="block text-xs mb-1" style={{ color: 'var(--text-mid)' }}>Tipo de seleção</label>
          <div className="flex gap-2">
            <RadioCard
              label="Única"
              hint="cliente escolhe 1"
              active={isUnica}
              onClick={() => setSelecao('unica')}
            />
            <RadioCard
              label="Múltipla"
              hint="pode escolher vários"
              active={!isUnica}
              onClick={() => setSelecao('multipla')}
            />
          </div>
        </div>

        <label className="flex items-center gap-3 mt-4 text-sm">
          <input
            type="checkbox"
            checked={obrigatorio}
            onChange={(e) => {
              const v = e.target.checked
              setObrigatorio(v)
              if (v && !isUnica && minEscolhas < 1) setMinEscolhas(1)
            }}
            style={{ width: 18, height: 18 }}
          />
          <span style={{ color: 'var(--ink)' }}>Obrigatório (cliente precisa escolher)</span>
        </label>

        {/* min/max só aparecem na seleção múltipla */}
        {!isUnica && (
          <div
            className="mt-4 rounded-xl p-3 flex flex-col gap-3"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--ink)' }}>Mínimo de escolhas</span>
              <Stepper
                value={minEscolhas}
                min={obrigatorio ? 1 : 0}
                onChange={setMinEscolhas}
              />
            </div>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={semTeto}
                onChange={(e) => setSemTeto(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              <span style={{ color: 'var(--ink)' }}>Sem limite máximo</span>
            </label>
            {!semTeto && (
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--ink)' }}>Máximo de escolhas</span>
                <Stepper value={maxEscolhas} min={1} onChange={setMaxEscolhas} />
              </div>
            )}
          </div>
        )}

        {/* Opções do grupo */}
        <div className="mt-6 mb-2 flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--text-mid)' }}>
            Opções
          </div>
          <button
            onClick={addOpcao}
            className="text-xs px-3 py-2 rounded-xl font-bold"
            style={{ background: 'var(--ink)', color: 'var(--bg)', border: 'none' }}
          >
            + Opção
          </button>
        </div>

        {opcoes.length === 0 && (
          <div className="text-xs py-3 text-center" style={{ color: 'var(--muted)' }}>
            Nenhuma opção ainda. Use “+ Opção”. Preço 0 serve para remoções (ex.: sem cebola).
          </div>
        )}

        <div className="flex flex-col gap-2">
          {opcoes.map((o) => (
            <div
              key={o.key}
              className="rounded-xl p-3 flex flex-col gap-2"
              style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
            >
              <input
                value={o.nome}
                onChange={(e) => { setOpcao(o.key, { nome: e.target.value }); setErr('') }}
                placeholder="Nome da opção (ex.: Bacon, Sem cebola)"
                className="w-full py-2 text-sm"
                style={inputStyle}
              />
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs" style={{ color: 'var(--text-mid)' }}>R$</span>
                  <input
                    value={o.preco}
                    onChange={(e) => setOpcao(o.key, { preco: fmt.moneyMask(e.target.value) })}
                    placeholder="0,00"
                    inputMode="numeric"
                    className="py-2 text-sm mono-num"
                    style={{ ...inputStyle, width: 80 }}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs" style={{ color: 'var(--text-mid)' }}>#</span>
                  <input
                    value={o.ordem}
                    onChange={(e) => setOpcao(o.key, { ordem: e.target.value.replace(/[^0-9]/g, '') })}
                    inputMode="numeric"
                    className="py-2 text-sm mono-num"
                    style={{ ...inputStyle, width: 44 }}
                  />
                </div>
                <button
                  onClick={() => setOpcao(o.key, { disponivel: !o.disponivel })}
                  className="text-[11px] px-2 py-1 rounded-full"
                  style={{
                    border: `1px solid ${o.disponivel ? 'var(--status-ready)' : 'var(--muted)'}`,
                    color: o.disponivel ? 'var(--status-ready)' : 'var(--muted)',
                  }}
                >
                  {o.disponivel ? 'Disponível' : 'Off'}
                </button>
                <button
                  onClick={() => removeOpcao(o)}
                  aria-label="Remover opção"
                  className="ml-auto w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ border: '1px solid var(--line)', color: 'var(--accent)' }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        <label className="flex items-center gap-3 mt-5 text-sm">
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <span style={{ color: 'var(--ink)' }}>Grupo ativo</span>
        </label>

        {err && <div className="mt-4 text-xs" style={{ color: 'var(--accent)' }}>{err}</div>}

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

const inputStyle: React.CSSProperties = {
  border: 'none',
  borderBottom: '1px solid var(--line)',
  background: 'transparent',
  color: 'var(--ink)',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <label className="block text-xs mb-1" style={{ color: 'var(--text-mid)' }}>{label}</label>
      {children}
    </div>
  )
}

function RadioCard({ label, hint, active, onClick }: { label: string; hint: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-xl px-3 py-2 text-left"
      style={{
        minHeight: 48,
        border: `1px solid ${active ? 'var(--accent)' : 'var(--line)'}`,
        background: active ? 'var(--surface)' : 'transparent',
      }}
    >
      <div className="text-sm font-bold" style={{ color: active ? 'var(--accent)' : 'var(--ink)' }}>{label}</div>
      <div className="text-[11px]" style={{ color: 'var(--text-mid)' }}>{hint}</div>
    </button>
  )
}

function Stepper({ value, min, onChange }: { value: number; min: number; onChange: (v: number) => void }) {
  const dec = () => onChange(Math.max(min, value - 1))
  const inc = () => onChange(value + 1)
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={dec}
        disabled={value <= min}
        aria-label="Diminuir"
        className="w-11 h-11 rounded-lg flex items-center justify-center text-lg"
        style={{ border: '1px solid var(--line)', color: value <= min ? 'var(--muted)' : 'var(--ink)' }}
      >
        −
      </button>
      <span className="mono-num text-base w-6 text-center" style={{ color: 'var(--ink)' }}>{value}</span>
      <button
        onClick={inc}
        aria-label="Aumentar"
        className="w-11 h-11 rounded-lg flex items-center justify-center text-lg"
        style={{ border: '1px solid var(--line)', color: 'var(--ink)' }}
      >
        +
      </button>
    </div>
  )
}
