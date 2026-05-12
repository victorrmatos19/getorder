type Props = {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'dark' | 'light'
  className?: string
}

export default function Logo({ size = 'md', variant = 'dark', className = '' }: Props) {
  const fontPx = size === 'sm' ? 14 : size === 'lg' ? 22 : 16
  const subPx = Math.round(fontPx * 0.7)
  const color = variant === 'light' ? '#FAF9F5' : 'var(--ink)'

  return (
    <span
      className={`serif inline-flex items-baseline ${className}`}
      style={{ color, fontSize: fontPx, letterSpacing: '0.02em', fontWeight: 600, lineHeight: 1 }}
    >
      637
      <span
        className="ml-1 font-sans"
        style={{
          opacity: 0.55,
          fontSize: subPx,
          fontWeight: 400,
          fontFamily: 'var(--font-sans)',
        }}
      >
        cervejaria
      </span>
    </span>
  )
}
