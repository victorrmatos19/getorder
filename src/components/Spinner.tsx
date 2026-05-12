type Props = { size?: number; color?: string }

export default function Spinner({ size = 16, color = '#FAF9F5' }: Props) {
  return (
    <span
      aria-hidden
      className="inline-block animate-spin rounded-full"
      style={{
        width: size,
        height: size,
        border: `2px solid rgba(255,255,255,0.25)`,
        borderTopColor: color,
      }}
    />
  )
}
