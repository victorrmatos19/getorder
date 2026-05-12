'use client'

import { useState } from 'react'
import Image from 'next/image'
import ProductStepper from './ProductStepper'
import { fmt } from '@/lib/formatters'
import type { Produto } from '@/types'

type Props = {
  produto: Produto
  quantidade: number
  obs: string
  onChangeQuantidade: (n: number) => void
  onChangeObs: (s: string) => void
  isLast?: boolean
}

const MAX_OBS = 200

export default function ProductCard({
  produto, quantidade, obs, onChangeQuantidade, onChangeObs, isLast,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const hasFoto = !!produto.foto_url
  const isOferta =
    produto.em_oferta && produto.oferta_preco != null && produto.oferta_preco < produto.preco

  return (
    <div
      className="py-4"
      style={{ borderBottom: isLast ? 'none' : '1px solid var(--line)' }}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setExpanded((v) => !v)}
        >
          {(produto.novidade || produto.em_oferta) && (
            <div className="flex gap-1.5 mb-1">
              {produto.novidade && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                  style={{ background: 'var(--accent)', color: '#FAF9F5' }}
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
            <div className="text-base" style={{ color: 'var(--ink)' }}>
              {produto.nome}
            </div>
            <div className="flex items-baseline gap-2 shrink-0">
              {isOferta && (
                <span
                  className="mono-num text-xs line-through"
                  style={{ color: 'var(--muted)' }}
                >
                  {fmt.currency(produto.preco)}
                </span>
              )}
              <span
                className="mono-num text-base font-bold"
                style={{ color: 'var(--accent)' }}
              >
                {fmt.currency(isOferta ? produto.oferta_preco! : produto.preco)}
              </span>
            </div>
          </div>
          {produto.descricao && (
            <div
              className="text-xs overflow-hidden transition-all"
              style={{
                color: 'var(--text-mid)',
                maxHeight: expanded ? 80 : 0,
                marginTop: expanded ? 4 : 0,
                lineHeight: 1.4,
              }}
            >
              {produto.descricao}
            </div>
          )}
        </div>

        {hasFoto && (
          <div
            className="relative shrink-0 overflow-hidden rounded-lg"
            style={{ width: 64, height: 64, background: 'var(--surface)' }}
          >
            <Image
              src={produto.foto_url!}
              alt={produto.nome}
              fill
              sizes="64px"
              className="object-cover"
            />
          </div>
        )}

        <ProductStepper value={quantidade} onChange={onChangeQuantidade} />
      </div>

      {quantidade > 0 && (
        <div className="mt-3 animate-fade-in">
          <label
            className="block text-xs mb-1"
            style={{ color: 'var(--text-mid)' }}
          >
            Observação (opcional)
          </label>
          <textarea
            value={obs}
            onChange={(e) => onChangeObs(e.target.value.slice(0, MAX_OBS))}
            placeholder="Ex.: sem cebola, ponto da carne"
            rows={2}
            maxLength={MAX_OBS}
            className="w-full text-base"
            style={{
              padding: 12,
              borderRadius: 12,
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              color: 'var(--ink)',
              resize: 'none',
              lineHeight: 1.4,
            }}
          />
          {obs && (
            <div className="text-[10px] text-right mt-0.5" style={{ color: 'var(--muted)' }}>
              {obs.length}/{MAX_OBS}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
