'use client'

import ThemeScope from '@/components/ThemeScope'
import { useRestaurante } from '@/lib/contexts/RestauranteContext'

// Aplica a marca do restaurante (cores) nas telas do garçom. Dentro do RestauranteProvider.
export default function GarcomThemeScope({ children }: { children: React.ReactNode }) {
  const { restaurante } = useRestaurante()
  return (
    <ThemeScope primaria={restaurante?.cor_primaria} accent={restaurante?.cor_accent}>
      {children}
    </ThemeScope>
  )
}
