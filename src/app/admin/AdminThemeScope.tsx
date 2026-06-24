'use client'

import ThemeScope from '@/components/ThemeScope'
import { useRestaurante } from '@/lib/contexts/RestauranteContext'
import AdminNav from './AdminNav'

// Aplica a marca do restaurante (cores) nas telas de admin. Precisa estar dentro do
// RestauranteProvider (layout). Sem cores definidas → defaults GetOrder.
export default function AdminThemeScope({ children }: { children: React.ReactNode }) {
  const { restaurante } = useRestaurante()
  return (
    <ThemeScope
      primaria={restaurante?.cor_primaria}
      accent={restaurante?.cor_accent}
      preco={restaurante?.cor_preco}
      className="min-h-screen flex flex-col pb-20"
      style={{ background: 'var(--bg)' }}
    >
      {children}
      <AdminNav />
    </ThemeScope>
  )
}
