'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Spinner from '@/components/Spinner'
import EmptyState from '@/components/EmptyState'
import CardapioView from './CardapioView'
import type { Mesa } from '@/types'

type Status = 'loading' | 'no-mesa' | 'ready' | 'closed' | 'error'

export default function MesaPage() {
  const params = useParams<{ id: string }>()
  const mesaId = params.id

  const [status, setStatus] = useState<Status>('loading')
  const [mesa, setMesa] = useState<Mesa | null>(null)
  const [comandaId, setComandaId] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    const init = async () => {
      // 1. Carrega e valida a mesa
      const { data: mesaData } = await supabase
        .from('mesas')
        .select('*')
        .eq('id', mesaId)
        .maybeSingle()

      if (!active) return

      if (!mesaData || !mesaData.ativo) {
        setStatus('no-mesa')
        return
      }
      setMesa(mesaData as Mesa)

      // 2. Busca a comanda aberta da mesa (modelo: uma comanda compartilhada por mesa)
      const { data: existente, error: findErr } = await supabase
        .from('comandas')
        .select('id')
        .eq('mesa_id', mesaId)
        .eq('status', 'aberta')
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!active) return
      if (findErr) {
        setStatus('error')
        return
      }

      if (existente) {
        setComandaId(existente.id)
        setStatus('ready')
        return
      }

      // 3. Não há comanda aberta — cria uma anônima (sem nome/CPF/LGPD)
      const { data: nova, error: insertErr } = await supabase
        .from('comandas')
        .insert({
          mesa_id: mesaData.id,
          restaurante_id: mesaData.restaurante_id,
          status: 'aberta',
        })
        .select('id')
        .single()

      if (!active) return
      if (insertErr || !nova) {
        setStatus('error')
        return
      }

      setComandaId(nova.id)
      setStatus('ready')
    }

    setStatus('loading')
    init()
    return () => { active = false }
  }, [mesaId, nonce])

  const onReset = () => {
    setComandaId(null)
    setStatus('closed')
  }

  const reabrir = () => {
    setComandaId(null)
    setNonce((n) => n + 1)
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size={24} color="var(--accent)" />
      </div>
    )
  }

  if (status === 'no-mesa') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <EmptyState
          icon="🚫"
          title="Mesa indisponível"
          description="Esta mesa não existe ou está desativada. Procure um atendente."
        />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-6">
        <EmptyState
          icon="⚠️"
          title="Não foi possível abrir a comanda"
          description="Verifique sua conexão e tente novamente."
        />
        <button
          onClick={reabrir}
          className="rounded-xl text-sm font-bold px-6"
          style={{ minHeight: 48, background: 'var(--accent)', color: '#FAF9F5', border: 'none' }}
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  if (status === 'closed') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-6">
        <EmptyState
          icon="👋"
          title="Você saiu da comanda"
          description="Escaneie o QR Code da mesa para voltar ao cardápio."
        />
        <button
          onClick={reabrir}
          className="rounded-xl text-sm font-bold px-6"
          style={{ minHeight: 48, background: 'var(--accent)', color: '#FAF9F5', border: 'none' }}
        >
          Voltar ao cardápio
        </button>
      </div>
    )
  }

  if (status === 'ready' && mesa && comandaId) {
    return <CardapioView mesa={mesa} comandaId={comandaId} onReset={onReset} />
  }

  return null
}
