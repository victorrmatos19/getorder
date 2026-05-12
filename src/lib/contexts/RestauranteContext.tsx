'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
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
  const [state, setState] = useState<Omit<ContextValue, 'isSuperAdmin'>>({
    restauranteId: null,
    restaurante: null,
    role: null,
    email: null,
    loading: true,
  })

  useEffect(() => {
    const supabase = createClient()
    let active = true

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
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
    return () => { active = false }
  }, [])

  const value = useMemo<ContextValue>(
    () => ({ ...state, isSuperAdmin: state.role === 'super_admin' }),
    [state],
  )

  return <RestauranteContext.Provider value={value}>{children}</RestauranteContext.Provider>
}

export function useRestaurante() {
  return useContext(RestauranteContext)
}
