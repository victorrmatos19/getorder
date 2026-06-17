'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Restaurante, Role } from '@/types'

type ContextValue = {
  restauranteId: string | null
  restaurante: Restaurante | null
  role: Role | null
  email: string | null
  loading: boolean
  isSuperAdmin: boolean
}

const RestauranteContext = createContext<ContextValue>({
  restauranteId: null,
  restaurante: null,
  role: null,
  email: null,
  loading: true,
  isSuperAdmin: false,
})

export function RestauranteProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<Omit<ContextValue, 'isSuperAdmin'>>({
    restauranteId: null,
    restaurante: null,
    role: null,
    email: null,
    loading: true,
  })

  // Guarda o usuário resolvido por último; ao trocar de usuário (login/logout/refresh com sub
  // diferente) limpamos o cache de queries do tenant antigo.
  const lastUserId = useRef<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      // Troca de usuário (inclui logout): descarta listas em cache do tenant anterior.
      if (lastUserId.current !== null && lastUserId.current !== (user?.id ?? null)) {
        queryClient.clear()
      }
      lastUserId.current = user?.id ?? null

      if (!user) {
        if (active) setState({ restauranteId: null, restaurante: null, role: null, email: null, loading: false })
        return
      }
      const { data: perfil } = await supabase
        .from('perfis')
        .select('role, restaurante_id')
        .eq('id', user.id)
        .maybeSingle()

      let restaurante: Restaurante | null = null
      if (perfil?.restaurante_id) {
        const { data: r } = await supabase
          .from('restaurantes')
          .select('*')
          .eq('id', perfil.restaurante_id)
          .maybeSingle()
        restaurante = (r as Restaurante) ?? null
      }

      if (!active) return
      setState({
        restauranteId: perfil?.restaurante_id ?? null,
        restaurante,
        role: (perfil?.role as Role) ?? null,
        email: user.email ?? null,
        loading: false,
      })
    }

    load()

    // Re-resolve o tenant quando a sessão muda (login, logout, refresh de token com outro usuário),
    // evitando restauranteId preso de uma sessão anterior enquanto o /admin segue montado.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        load()
      }
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [queryClient])

  const value = useMemo<ContextValue>(
    () => ({ ...state, isSuperAdmin: state.role === 'super_admin' }),
    [state],
  )

  return <RestauranteContext.Provider value={value}>{children}</RestauranteContext.Provider>
}

export function useRestaurante() {
  return useContext(RestauranteContext)
}
