'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'
import Spinner from '@/components/Spinner'
import EmptyState from '@/components/EmptyState'
import IdentificacaoForm from './IdentificacaoForm'
import CardapioView from './CardapioView'
import type { Mesa } from '@/types'

type Status = 'loading' | 'no-mesa' | 'needs-id' | 'ready'

export default function MesaPage() {
  const params = useParams<{ id: string }>()
  const mesaId = params.id

  const [status, setStatus] = useState<Status>('loading')
  const [mesa, setMesa] = useState<Mesa | null>(null)
  const [comandaId, setComandaId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    const init = async () => {
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

      const stored = typeof window !== 'undefined'
        ? localStorage.getItem(`637_comanda_${mesaId}`)
        : null

      if (stored) {
        const { data: c } = await supabase
          .from('comandas')
          .select('id, status')
          .eq('id', stored)
          .maybeSingle()
        if (c && c.status === 'aberta') {
          if (!active) return
          setComandaId(c.id)
          setStatus('ready')
          return
        }
        localStorage.removeItem(`637_comanda_${mesaId}`)
      }

      if (!active) return
      setStatus('needs-id')
    }

    init()
    return () => { active = false }
  }, [mesaId])

  const onIdentified = (newComandaId: string) => {
    localStorage.setItem(`637_comanda_${mesaId}`, newComandaId)
    setComandaId(newComandaId)
    setStatus('ready')
  }

  const onReset = () => {
    localStorage.removeItem(`637_comanda_${mesaId}`)
    setComandaId(null)
    setStatus('needs-id')
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

  if (status === 'needs-id' && mesa) {
    return <IdentificacaoForm mesa={mesa} onIdentified={onIdentified} />
  }

  if (status === 'ready' && mesa && comandaId) {
    return <CardapioView mesa={mesa} comandaId={comandaId} onReset={onReset} />
  }

  return null
}
