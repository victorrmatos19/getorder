'use client'

import Image from 'next/image'
import { fmt } from '@/lib/formatters'
import { precoEfetivo } from '@/lib/calcComanda'
import type { Produto } from '@/types'

type Props = {
  produto: Produto
  onOpen: () => void
  isLast?: boolean
}

export default function ProductCard({ produto, onOpen, isLast }: Props) {
  const hasFoto = !!produto.foto_url
  const isEsgotado = produto.esgotado
  const isOferta =
    !isEsgotado &&
    produto.em_oferta && produto.oferta_preco != null && produto.oferta_preco < produto.preco

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left py-4 flex items-start gap-4"
      style={{
        borderBottom: isLast ? 'none' : '1px solid var(--line)',
        background: 'transparent',
        opacity: isEsgotado ? 0.6 : 1,
      }}
    >
      <div className="flex-1 min-w-0">
        {(produto.novidade || produto.em_oferta || isEsgotado) && (
          <div className="flex gap-1.5 mb-1">
            {isEsgotado && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
              >
                Esgotado
              </span>
            )}
            {produto.novidade && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
              >
                Novo
              </span>
            )}
            {produto.em_oferta && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                style={{ background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)' }}
              >
                Oferta
              </span>
            )}
          </div>
        )}
        <div className="flex items-baseline justify-between gap-3 mb-0.5">
          <div
            className={`text-base truncate${isEsgotado ? ' line-through' : ''}`}
            style={{ color: isEsgotado ? 'var(--accent)' : 'var(--ink)' }}
          >
            {produto.nome}
          </div>
          <div className="flex items-baseline gap-2 shrink-0">
            {isOferta && (
              <span className="mono-num text-xs line-through" style={{ color: 'var(--muted)' }}>
                {fmt.currency(produto.preco)}
              </span>
            )}
            <span
              className={`mono-num text-base font-bold${isEsgotado ? ' line-through' : ''}`}
              style={{ color: isEsgotado ? 'var(--muted)' : 'var(--price)' }}
            >
              {fmt.currency(precoEfetivo(produto))}
            </span>
          </div>
        </div>
        {produto.descricao && (
          <div className="text-xs truncate" style={{ color: 'var(--text-mid)', lineHeight: 1.4 }}>
            {produto.descricao}
          </div>
        )}
      </div>

      {hasFoto && (
        <div
          className="relative shrink-0 overflow-hidden rounded-lg"
          style={{ width: 64, height: 64, background: 'var(--surface)' }}
        >
          <Image src={produto.foto_url!} alt={produto.nome} fill sizes="64px" className="object-cover" />
        </div>
      )}

      <span
        aria-hidden
        className="shrink-0 self-center w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ border: '1px solid var(--line)', color: 'var(--ink)' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </span>
    </button>
  )
}
