'use client'

import Image from 'next/image'
import Logo from './Logo'

type Props = {
  logoUrl?: string | null
  nome?: string | null
  size?: 'sm' | 'md' | 'lg'
  variant?: 'dark' | 'light'
  showCobranding?: boolean
  className?: string
}

const H = { sm: 24, md: 32, lg: 44 } as const

/**
 * White-label — logo do restaurante (com fallback para o logo GetOrder).
 *
 * Com `logoUrl`: mostra a imagem do restaurante (next/image). Sem logo: cai para o
 * símbolo/wordmark GetOrder, preservando a identidade de quem não personalizou.
 * `showCobranding`: quando há logo próprio, anexa um selo discreto "via GetOrder".
 */
export default function BrandLogo({
  logoUrl,
  nome,
  size = 'sm',
  variant = 'dark',
  showCobranding = false,
  className = '',
}: Props) {
  const h = H[size]
  const isLight = variant === 'light'

  if (!logoUrl) {
    return <Logo size={size} variant={variant} className={className} />
  }

  const cobrandColor = isLight ? 'rgba(250,249,245,0.55)' : 'var(--muted)'

  return (
    <span className={`inline-flex items-center gap-2 ${className}`} style={{ lineHeight: 1 }}>
      <Image
        src={logoUrl}
        alt={nome ? `Logo ${nome}` : 'Logo'}
        width={160}
        height={h}
        sizes="160px"
        className="object-contain object-left"
        style={{ height: h, width: 'auto', maxWidth: 160 }}
        priority
      />
      {showCobranding && (
        <span
          className="font-sans"
          style={{ color: cobrandColor, fontSize: 10, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}
        >
          via GetOrder
        </span>
      )}
    </span>
  )
}
