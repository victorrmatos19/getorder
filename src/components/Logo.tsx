type Props = {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'dark' | 'light'
  showWordmark?: boolean
  className?: string
}

export default function Logo({
  size = 'md',
  variant = 'dark',
  showWordmark = true,
  className = '',
}: Props) {
  const fontPx = size === 'sm' ? 14 : size === 'lg' ? 22 : 16
  const sym = Math.round(fontPx * 1.5)

  const isLight = variant === 'light'
  const mainStroke = isLight ? '#FAF9F5' : 'var(--primary)'
  const accentStroke = isLight ? '#C56B56' : 'var(--accent)'
  const textColor = isLight ? '#FAF9F5' : 'var(--ink)'

  return (
    <span className={`inline-flex items-center gap-2 ${className}`} style={{ lineHeight: 1 }}>
      <svg width={sym} height={sym} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path
          d="M14 11 a3 3 0 0 1 3 -3 H31 a3 3 0 0 1 3 3 V38 l-3.3 -2.4 l-3.3 2.4 l-3.4 -2.4 l-3.3 2.4 l-3.3 -2.4 L14 38 Z"
          stroke={mainStroke}
          strokeWidth="3.4"
          strokeLinejoin="round"
        />
        <line x1="19" y1="16" x2="29" y2="16" stroke={mainStroke} strokeWidth="2.6" strokeLinecap="round" />
        <line x1="19" y1="21.5" x2="26" y2="21.5" stroke={mainStroke} strokeWidth="2.6" strokeLinecap="round" />
        <line x1="19" y1="28" x2="29" y2="28" stroke={accentStroke} strokeWidth="3.2" strokeLinecap="round" />
      </svg>
      {showWordmark && (
        <span
          className="font-sans"
          style={{
            color: textColor,
            fontSize: fontPx,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            fontFamily: 'var(--font-sans)',
          }}
        >
          GetOrder
        </span>
      )}
    </span>
  )
}
