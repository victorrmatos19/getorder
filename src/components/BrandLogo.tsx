'use client'

import Image from 'next/image'
import Logo from './Logo'

type Props = {
  logoUrl?: string | null
  nome?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  shape?: 'square' | 'circle'
  variant?: 'dark' | 'light'
  showCobranding?: boolean
  className?: string
}

const H = { sm: 24, md: 32, lg: 44, xl: 72 } as const

/**
 * White-label — logo do restaurante (com fallback para o logo GetOrder).
 *
 * Com `logoUrl`: mostra a imagem do restaurante (next/image). Sem logo: cai para o
 * símbolo/wordmark GetOrder, preservando a identidade de quem não personalizou.
 * `shape="circle"`: recorta o logo num círculo (object-cover) — bom para logos com fundo
 * colorido (esconde o "quadrado" feio). `showCobranding`: selo discreto "via GetOrder".
 */
export default function BrandLogo({
  logoUrl,
  nome,
  size = 'sm',
  shape = 'square',
  variant = 'dark',
  showCobranding = false,
  className = '',
}: Props) {
  const h = H[size]
  const isLight = variant === 'light'

  if (!logoUrl) {
    // O logo GetOrder (fallback) só tem tamanhos sm/md/lg.
    return <Logo size={size === 'xl' ? 'lg' : size} variant={variant} className={className} />
  }

  const cobrandColor = isLight ? 'rgba(250,249,245,0.55)' : 'var(--muted)'
  const alt = nome ? `Logo ${nome}` : 'Logo'

  return (
    <span className={`inline-flex items-center gap-2 ${className}`} style={{ lineHeight: 1 }}>
      {shape === 'circle' ? (
        <span
          className="block overflow-hidden shrink-0"
          style={{ width: h, height: h, borderRadius: '9999px' }}
        >
          <Image
            src={logoUrl}
            alt={alt}
            width={h}
            height={h}
            sizes={`${h}px`}
            className="object-cover"
            style={{ width: h, height: h }}
            priority
          />
        </span>
      ) : (
        <Image
          src={logoUrl}
          alt={alt}
          width={160}
          height={h}
          sizes="160px"
          className="object-contain object-left"
          style={{ height: h, width: 'auto', maxWidth: 160 }}
          priority
        />
      )}
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
