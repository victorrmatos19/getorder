'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Spinner from '@/components/Spinner'
import { fmt } from '@/lib/formatters'
import { subtotalItem } from '@/lib/calcComanda'
import type { FormaPagamento, ItemPedido, Restaurante } from '@/types'

type Props = {
  comandaId: string
  clienteNome: string | null
  mesaNome: string
  restauranteId: string
  itens: ItemPedido[]
  subtotal: number
  onClose: () => void
  onSuccess: () => void
}

const METHODS: { id: FormaPagamento; label: string; emoji: string }[] = [
  { id: 'credito',  label: 'Crédito',  emoji: '💳' },
  { id: 'debito',   label: 'Débito',   emoji: '💳' },
  { id: 'pix',      label: 'PIX',      emoji: '📱' },
  { id: 'dinheiro', label: 'Dinheiro', emoji: '💵' },
]

export default function CheckoutModal({
  comandaId, clienteNome, mesaNome, restauranteId, itens, subtotal, onClose, onSuccess,
}: Props) {
  const [restaurante, setRestaurante] = useState<Restaurante | null>(null)
  const [method, setMethod] = useState<FormaPagamento | null>(null)
  const [recebido, setRecebido] = useState('')
  const [taxaAplicada, setTaxaAplicada] = useState(true)
  const [numeroPessoas, setNumeroPessoas] = useState(1)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [success, setSuccess] = useState<{ method: FormaPagamento; total: number } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('restaurantes')
      .select('*')
      .eq('id', restauranteId)
      .maybeSingle()
      .then(({ data }) => {
        const r = data as Restaurante | null
        setRestaurante(r)
        if (r) setTaxaAplicada(r.taxa_servico_obrigatoria ? true : true)
      })
  }, [restauranteId])

  const taxaPercentual = restaurante?.taxa_servico_percentual ?? 10
  const taxaObrigatoria = restaurante?.taxa_servico_obrigatoria ?? false
  const efetivamenteAplicada = taxaObrigatoria || taxaAplicada
  const servico = efetivamenteAplicada ? Math.round(subtotal * (taxaPercentual / 100) * 100) / 100 : 0
  const total = subtotal + servico
  const valorPorPessoa = numeroPessoas > 0 ? Math.round((total / numeroPessoas) * 100) / 100 : total

  const recebidoNum = fmt.moneyParse(recebido)
  const troco = method === 'dinheiro' ? Math.max(0, recebidoNum - total) : 0
  const podeConfirmar = !!method && !busy && (method !== 'dinheiro' || recebidoNum >= total)

  // Itens ativos, sem merge — cada item carrega seus próprios adicionais.
  const itensAtivos = useMemo(
    () => itens.filter((it) => it.status !== 'cancelado'),
    [itens],
  )

  const confirmar = async () => {
    if (!method) return
    setErr('')
    setBusy(true)
    try {
      const supabase = createClient()
      const { error: e1 } = await supabase
        .from('comandas')
        .update({
          status: 'fechada',
          forma_pagamento: method,
          total,
          taxa_servico_valor: servico,
          taxa_servico_aplicada: efetivamenteAplicada,
          numero_pessoas: numeroPessoas,
          fechado_em: new Date().toISOString(),
        })
        .eq('id', comandaId)
      if (e1) throw e1

      const { error: e2 } = await supabase
        .from('itens_pedido')
        .update({ status: 'entregue' })
        .eq('comanda_id', comandaId)
        .neq('status', 'cancelado')
      if (e2) throw e2

      setSuccess({ method, total })
    } catch (e: any) {
      setErr(e.message || 'Erro ao encerrar a comanda.')
    } finally {
      setBusy(false)
    }
  }

  if (success) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-6"
        style={{ background: 'rgba(0,0,0,0.55)' }}
      >
        <div
          className="w-full max-w-sm rounded-xl p-6 animate-slide-up text-center"
          style={{ background: 'var(--bg)' }}
        >
          <div
            className="mx-auto mb-5 w-14 h-14 rounded-full flex items-center justify-center"
            style={{ border: '1px solid var(--status-ready)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--status-ready)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5 9-11" />
            </svg>
          </div>
          <div className="serif text-xl" style={{ color: 'var(--ink)' }}>
            Comanda encerrada
          </div>
          <div className="text-sm mt-1" style={{ color: 'var(--text-mid)' }}>
            {clienteNome ? `${clienteNome} · ` : ''}{mesaNome}
          </div>
          <div
            className="serif mono-num text-2xl my-4"
            style={{ color: 'var(--accent)', fontWeight: 500 }}
          >
            {fmt.currency(success.total)} recebido
          </div>
          <div className="text-xs mb-1" style={{ color: 'var(--text-mid)' }}>
            via {METHODS.find((m) => m.id === success.method)?.label}
          </div>
          {numeroPessoas > 1 && (
            <div className="text-xs mb-4" style={{ color: 'var(--text-mid)' }}>
              Dividido entre {numeroPessoas} pessoas ({fmt.currency(valorPorPessoa)} cada)
            </div>
          )}
          <button
            onClick={onSuccess}
            className="w-full rounded-xl text-sm font-bold mt-4"
            style={{
              minHeight: 48,
              background: 'transparent',
              border: '1px solid var(--line)',
              color: 'var(--ink)',
            }}
          >
            Voltar para mesas
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={() => !busy && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full animate-slide-up safe-bottom max-h-[92vh] overflow-y-auto"
        style={{ background: 'var(--bg)', borderRadius: '20px 20px 0 0' }}
      >
        <div className="px-6 pt-6 pb-2 flex items-center justify-between">
          <div>
            <div className="text-xs" style={{ color: 'var(--text-mid)' }}>
              {mesaNome}{clienteNome ? ` · ${clienteNome}` : ''}
            </div>
            <div className="serif text-lg" style={{ color: 'var(--ink)' }}>
              Encerramento
            </div>
          </div>
          <button
            onClick={() => !busy && onClose()}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ border: '1px solid var(--line)', color: 'var(--text-mid)' }}
            aria-label="Fechar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-2">
          <div
            className="flex justify-between items-baseline py-4"
            style={{ borderBottom: '1px solid var(--line)' }}
          >
            <span
              className="text-xs uppercase tracking-wider"
              style={{ color: 'var(--text-mid)' }}
            >
              Total
            </span>
            <span
              className="serif mono-num text-4xl"
              style={{ color: 'var(--accent)', fontWeight: 500, lineHeight: 1 }}
            >
              {fmt.currency(total)}
            </span>
          </div>
        </div>

        {/* Resumo */}
        <div className="px-6 mb-4">
          <div
            className="text-xs font-bold uppercase tracking-wider mb-2"
            style={{ color: 'var(--text-mid)' }}
          >
            Resumo
          </div>
          {itensAtivos.map((it) => (
            <div key={it.id} className="py-1.5 text-sm">
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-mid)' }}>{it.produto?.nome ?? '—'} × {it.quantidade}</span>
                <span className="mono-num" style={{ color: 'var(--ink)' }}>{fmt.currency(subtotalItem(it))}</span>
              </div>
              {(it.adicionais ?? []).map((a) => (
                <div key={a.id} className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-mid)' }}>
                  <span>+ {a.nome_snapshot}</span>
                  {a.preco_snapshot > 0 && (
                    <span className="mono-num" style={{ color: 'var(--accent)' }}>({fmt.currency(a.preco_snapshot)})</span>
                  )}
                </div>
              ))}
              {it.obs && (
                <div className="text-xs italic mt-0.5" style={{ color: 'var(--text-mid)' }}>
                  ↳ {it.obs}
                </div>
              )}
            </div>
          ))}

          <div
            className="flex justify-between items-center py-3 mt-2"
            style={{ borderTop: '1px solid var(--line)' }}
          >
            <div>
              <div className="text-sm" style={{ color: 'var(--ink)' }}>
                Taxa de serviço ({taxaPercentual}%)
              </div>
              <div className="text-xs" style={{ color: 'var(--text-mid)' }}>
                {taxaObrigatoria ? 'Obrigatória' : 'Opcional'}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className="mono-num text-sm font-bold"
                style={{ color: efetivamenteAplicada ? 'var(--ink)' : 'var(--muted)' }}
              >
                {fmt.currency(servico)}
              </span>
              <button
                type="button"
                onClick={() => !taxaObrigatoria && setTaxaAplicada((v) => !v)}
                aria-label="Alternar taxa de serviço"
                disabled={taxaObrigatoria}
                title={taxaObrigatoria ? 'Taxa obrigatória' : undefined}
                className="rounded-full flex items-center transition-colors"
                style={{
                  width: 40,
                  height: 22,
                  background: efetivamenteAplicada ? 'var(--primary)' : 'var(--line)',
                  padding: 2,
                  cursor: taxaObrigatoria ? 'not-allowed' : 'pointer',
                  opacity: taxaObrigatoria ? 0.6 : 1,
                }}
              >
                <span
                  className="rounded-full transition-transform"
                  style={{
                    width: 16,
                    height: 16,
                    background: 'var(--bg)',
                    transform: efetivamenteAplicada ? 'translateX(18px)' : 'translateX(0)',
                  }}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Divisão de conta */}
        <div className="px-6 mb-5">
          <div
            className="text-xs font-bold uppercase tracking-wider mb-3"
            style={{ color: 'var(--text-mid)' }}
          >
            Dividir conta
          </div>
          <div
            className="rounded-xl p-3"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm" style={{ color: 'var(--ink)' }}>Número de pessoas</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setNumeroPessoas((n) => Math.max(1, n - 1))}
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ border: '1px solid var(--line)', color: 'var(--ink)' }}
                  aria-label="Diminuir"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M5 12h14" />
                  </svg>
                </button>
                <span className="mono-num font-bold text-base" style={{ color: 'var(--ink)', minWidth: 24, textAlign: 'center' }}>
                  {numeroPessoas}
                </span>
                <button
                  onClick={() => setNumeroPessoas((n) => Math.min(20, n + 1))}
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ border: '1px solid var(--line)', color: 'var(--ink)' }}
                  aria-label="Aumentar"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>
            </div>
            {numeroPessoas > 1 && (
              <div
                className="flex items-center justify-between pt-2"
                style={{ borderTop: '1px solid var(--line)' }}
              >
                <span className="text-sm" style={{ color: 'var(--text-mid)' }}>Valor por pessoa</span>
                <span className="serif mono-num text-lg" style={{ color: 'var(--accent)', fontWeight: 500 }}>
                  {fmt.currency(valorPorPessoa)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Métodos */}
        <div className="px-6 mb-5">
          <div
            className="text-xs font-bold uppercase tracking-wider mb-3"
            style={{ color: 'var(--text-mid)' }}
          >
            Forma de pagamento
          </div>
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map((m) => {
              const active = method === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className="rounded-xl flex items-center gap-3 text-sm"
                  style={{
                    minHeight: 56,
                    padding: '0 12px',
                    border: `1px solid ${active ? 'var(--ink)' : 'var(--line)'}`,
                    background: active ? 'var(--surface)' : 'transparent',
                    color: active ? 'var(--ink)' : 'var(--text-mid)',
                    fontWeight: active ? 700 : 400,
                  }}
                >
                  <span aria-hidden className="text-lg">{m.emoji}</span>
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>

        {method === 'dinheiro' && (
          <div className="px-6 mb-5 animate-slide-up">
            <label
              className="block text-xs mb-2"
              style={{ color: 'var(--text-mid)' }}
            >
              Valor recebido
            </label>
            <input
              value={recebido}
              onChange={(e) => setRecebido(fmt.moneyMask(e.target.value))}
              placeholder="0,00"
              inputMode="numeric"
              className="w-full text-lg font-bold mono-num py-3"
              style={{
                border: 'none',
                borderBottom: `1px solid ${recebido ? 'var(--ink)' : 'var(--line)'}`,
                background: 'transparent',
                color: 'var(--ink)',
                transition: 'border-color 0.2s',
              }}
            />
            {recebidoNum > 0 && (
              <div
                className="mt-3 pt-3 flex justify-between items-baseline"
                style={{ borderTop: '1px solid var(--line)' }}
              >
                <span className="text-sm" style={{ color: 'var(--text-mid)' }}>Troco</span>
                <span
                  className="serif mono-num text-lg"
                  style={{
                    color: recebidoNum >= total ? 'var(--ink)' : 'var(--accent)',
                    fontWeight: 500,
                  }}
                >
                  {fmt.currency(troco)}
                </span>
              </div>
            )}
          </div>
        )}

        {err && (
          <div className="px-6 mb-3 text-xs" style={{ color: 'var(--accent)' }}>{err}</div>
        )}

        <div className="px-6 pt-3 pb-5" style={{ borderTop: '1px solid var(--line)', background: 'var(--bg)' }}>
          <button
            onClick={confirmar}
            disabled={!podeConfirmar}
            className="w-full rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            style={{
              minHeight: 52,
              background: podeConfirmar ? 'var(--accent)' : 'var(--line)',
              color: podeConfirmar ? '#FAF9F5' : 'var(--muted)',
              border: 'none',
              cursor: podeConfirmar ? 'pointer' : 'not-allowed',
            }}
          >
            {busy ? <><Spinner /> Processando</> : (method ? 'Confirmar Pagamento' : 'Selecione a forma de pagamento')}
          </button>
        </div>
      </div>
    </div>
  )
}
