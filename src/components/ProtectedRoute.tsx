'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Role } from '@/types'
import Spinner from './Spinner'

type Props = {
  allow: Role[]
  children: React.ReactNode
}

type State = { loading: true } | { loading: false; ok: boolean; email?: string; role?: Role }

export default function ProtectedRoute({ allow, children }: Props) {
  const router = useRouter()
  const [state, setState] = useState<State>({ loading: true })

  useEffect(() => {
    const supabase = createClient()
    let active = true

    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (active) router.replace('/login')
        return
      }
      const { data: perfil } = await supabase
        .from('perfis')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      const role = perfil?.role as Role | undefined
      const ok = !!role && (role === 'super_admin' || allow.includes(role))
      if (!active) return
      if (!ok) {
        router.replace('/login?forbidden=1')
        return
      }
      setState({ loading: false, ok: true, email: user.email ?? undefined, role })
    }

    check()
    return () => {
      active = false
    }
  }, [router, allow])

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size={24} color="var(--accent)" />
      </div>
    )
  }

  return <>{children}</>
}
