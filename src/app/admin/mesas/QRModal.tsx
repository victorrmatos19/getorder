'use client'

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type { Mesa } from '@/types'

export default function QRModal({ mesa, onClose }: { mesa: Mesa; onClose: () => void }) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUrl(`${window.location.origin}/mesa/${mesa.id}`)
    }
  }, [mesa.id])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="print-area w-full max-w-sm rounded-xl p-6 text-center animate-slide-up"
        style={{ background: 'var(--bg)' }}
      >
        <div className="serif text-xl mb-1" style={{ color: 'var(--ink)' }}>{mesa.nome}</div>
        <div className="text-xs mb-4 print:hidden" style={{ color: 'var(--text-mid)' }}>
          Escaneie para abrir sua comanda
        </div>
        <div
          className="qr-box mx-auto mb-4 inline-block p-4 rounded-xl"
          style={{ background: '#FFFFFF', border: '1px solid var(--line)' }}
        >
          {url && <QRCodeSVG value={url} size={240} />}
        </div>
        <div className="text-xs break-all print:hidden" style={{ color: 'var(--text-mid)' }}>{url}</div>
        <div className="flex gap-2 mt-6 print:hidden">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl text-sm"
            style={{ minHeight: 48, border: '1px solid var(--line)', color: 'var(--text-mid)' }}
          >
            Fechar
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-xl text-sm font-bold"
            style={{
              flex: 2,
              minHeight: 48,
              background: 'var(--accent)',
              color: '#FAF9F5',
              border: 'none',
            }}
          >
            Imprimir
          </button>
        </div>
      </div>
    </div>
  )
}
