'use client'

type Props = {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
}

export default function ProductStepper({ value, onChange, min = 0, max = 99 }: Props) {
  const dec = () => onChange(Math.max(min, value - 1))
  const inc = () => onChange(Math.min(max, value + 1))

  return (
    <div className="flex items-center gap-2 shrink-0">
      {value > 0 && (
        <>
          <button
            type="button"
            onClick={dec}
            aria-label="Remover"
            className="w-11 h-11 rounded-xl flex items-center justify-center border"
            style={{ borderColor: 'var(--line)', color: 'var(--ink)', background: 'transparent' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M5 12h14" />
            </svg>
          </button>
          <span
            className="mono-num text-base font-bold text-center"
            style={{ color: 'var(--ink)', minWidth: 20 }}
          >
            {value}
          </span>
        </>
      )}
      <button
        type="button"
        onClick={inc}
        aria-label="Adicionar"
        className="w-11 h-11 rounded-xl flex items-center justify-center"
        style={{
          border: value > 0 ? '1px solid var(--line)' : '1px solid var(--ink)',
          background: value > 0 ? 'transparent' : 'var(--ink)',
          color: value > 0 ? 'var(--ink)' : 'var(--bg)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  )
}
