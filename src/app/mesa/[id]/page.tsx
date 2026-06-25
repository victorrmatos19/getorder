'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { abrirComandaMesa } from '@/lib/comandaCliente'
import Spinner from '@/components/Spinner'
import EmptyState from '@/components/EmptyState'
import CardapioView from './CardapioView'
import type { Mesa } from '@/types'

// Estados separados de "mesa indisponível" para a falha se auto-explicar:
//  - not-found  : a leitura voltou 0 linhas (QR aponta p/ mesa inexistente)
//  - inactive   : a mesa existe mas está ativo=false
//  - read-error : a query falhou (RLS/permissão/rede) — antes isso se mascarava de "not-found"
type Status = 'loading' | 'not-found' | 'inactive' | 'read-error' | 'ready' | 'closed' | 'error'

// Leitura da mesa com pequenas retentativas (400ms, 800ms). Cobre a janela logo
// após criar a mesa, blip de rede (comum em celular/webview) e propagação. Sai na
// 1ª leitura que retornar a linha; só insiste enquanto não houver `data`.
async function lerMesaComRetry(
  supabase: ReturnType<typeof createClient>,
  mesaId: string,
  tentativas = 3,
) {
  let last = await supabase.from('mesas').select('*').eq('id', mesaId).maybeSingle()
  for (let i = 1; i < tentativas && !last.data; i++) {
    await new Promise((r) => setTimeout(r, 400 * i))
    last = await supabase.from('mesas').select('*').eq('id', mesaId).maybeSingle()
  }
  return last
}

export default function MesaPage() {
  const params = useParams<{ id: string }>()
  const mesaId = params.id

  const [status, setStatus] = useState<Status>('loading')
  const [mesa, setMesa] = useState<Mesa | null>(null)
  const [comandaId, setComandaId] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    // no-store: a leitura pública da mesa nunca vem de cache (ver client.ts).
    const supabase = createClient({ noStore: true })
    let active = true

    const init = async () => {
      // A mesa é leitura pública (cardápio). A comanda é aberta/reusada SÓ via RPC
      // SECURITY DEFINER (o cliente não insere/lê comandas direto — RLS escopada).
      // Retry: tolera a janela pós-criação / blip de rede antes de declarar falha.
      const mesaRes = await lerMesaComRetry(supabase, mesaId)

      if (!active) return

      // Erro de leitura (RLS/permissão/rede) é DIFERENTE de "mesa não existe".
      // A leitura de `mesas` é pública por design (migration 008); se cair aqui,
      // a leitura pública provavelmente quebrou em produção — logamos a causa real.
      if (mesaRes.error) {
        console.error('[mesa] falha ao ler mesa:', mesaRes.error)
        setStatus('read-error')
        return
      }

      const mesaData = mesaRes.data
      if (!mesaData) {
        setStatus('not-found')
        return
      }
      if (!mesaData.ativo) {
        setStatus('inactive')
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

  if (status === 'not-found') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-6">
        <EmptyState
          icon="🚫"
          title="Mesa não encontrada"
          description="Este QR Code não corresponde a nenhuma mesa. Se acabou de ser criada, tente de novo; senão, procure um atendente."
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

  if (status === 'inactive') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-6">
        <EmptyState
          icon="🚫"
          title="Mesa desativada"
          description="Esta mesa está desativada no momento. Procure um atendente."
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

  if (status === 'read-error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-6">
        <EmptyState
          icon="⚠️"
          title="Não foi possível carregar a mesa"
          description="Tente novamente em instantes. Se continuar, mostre esta tela ao atendente."
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
