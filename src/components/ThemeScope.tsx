'use client'

import type { CSSProperties, ReactNode } from 'react'
import { deriveTheme } from '@/lib/theme'

type Props = {
  primaria: string | null | undefined
  accent: string | null | undefined
  dark?: boolean
  className?: string
  style?: CSSProperties
  children: ReactNode
}

/**
 * White-label — injeta os CSS tokens derivados da marca do restaurante num wrapper.
 *
 * As variables ficam em `style` inline (serializado no SSR → sem flash/mismatch) e
 * cascateiam para todos os filhos. Cores nulas → `deriveTheme` devolve os defaults do
 * GetOrder (zero regressão). Não usa `dangerouslySetInnerHTML` nem muta o document.
 */
export default function ThemeScope({ primaria, accent, dark, className, style, children }: Props) {
  const tokens = deriveTheme(primaria, accent, { dark }) as Record<string, string>
  return (
    <div className={className} style={{ ...(tokens as CSSProperties), ...style }}>
      {children}
    </div>
  )
}
