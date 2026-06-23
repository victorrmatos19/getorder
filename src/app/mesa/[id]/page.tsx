'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { abrirComandaMesa } from '@/lib/comandaCliente'
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
      // A mesa é leitura pública (cardápio). A comanda é aberta/reusada SÓ via RPC
      // SECURITY DEFINER (o cliente não insere/lê comandas direto — RLS escopada).
      const mesaRes = await supabase.from('mesas').select('*').eq('id', mesaId).maybeSingle()

      if (!active) return

      const mesaData = mesaRes.data
      if (!mesaData || !mesaData.ativo) {
        setStatus('no-mesa')
        return
      }
      setMesa(mesaData as Mesa)

      // find-or-create da comanda aberta da mesa (servidor reusa a comanda existente)
      try {
        const novaId = await abrirComandaMesa(mesaData.id)
        if (!active) return
        setComandaId(novaId)
        setStatus('ready')
      } catch {
        if (!active) return
        setStatus('error')
      }
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
