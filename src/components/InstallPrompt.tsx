'use client'

import { useEffect, useState } from 'react'
import Logo from './Logo'

// Evento não-padrão do Chromium (não existe na lib TS por padrão).
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'getorder.install.dismissed'

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

/**
 * Convite de instalação da PWA — montado APENAS no staff (cozinha/garçom/admin/super-admin),
 * por baixo do ProtectedRoute. NUNCA no fluxo público do cliente (/mesa, /privacidade, /login).
 * Discreto e dismissível. Em iOS/Safari (sem beforeinstallprompt) mostra a instrução manual.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [iosHint, setIosHint] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isStandalone()) return // já instalado → nada a oferecer
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return
    } catch {
      /* localStorage indisponível — segue mostrando */
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault() // impede o mini-infobar; controlamos o convite
      try {
        if (localStorage.getItem(DISMISS_KEY) === '1') return // já dispensado nesta sessão
      } catch {}
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    const onInstalled = () => {
      setVisible(false)
      try {
        localStorage.setItem(DISMISS_KEY, '1')
      } catch {}
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    // iOS/Safari não dispara beforeinstallprompt → mostra a instrução de "Adicionar à Tela de Início".
    if (isIos()) {
      setIosHint(true)
      setVisible(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!visible) return null

  const dismiss = () => {
    setVisible(false)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {}
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    setVisible(false)
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pt-4 safe-bottom pointer-events-none"
      role="dialog"
      aria-label="Instalar o GetOrder"
    >
      <div
        className="pointer-events-auto w-full max-w-md rounded-xl flex items-center gap-3 px-4 py-3"
        style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
      >
        <div className="shrink-0" aria-hidden>
          <Logo size="sm" showWordmark={false} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold leading-tight" style={{ color: 'var(--ink)' }}>
            Instalar o GetOrder
          </div>
          {iosHint ? (
            <div className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-mid)' }}>
              Toque em <span style={{ color: 'var(--accent)' }}>Compartilhar</span> → “Adicionar à Tela de Início”.
            </div>
          ) : (
            <div className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-mid)' }}>
              Acesso rápido, em tela cheia.
            </div>
          )}
        </div>

        {!iosHint && (
          <button
            onClick={install}
            className="shrink-0 rounded-lg text-sm font-bold px-4"
            style={{ minHeight: 48, background: 'var(--accent)', color: '#FAF9F5', border: 'none' }}
          >
            Instalar
          </button>
        )}

        <button
          onClick={dismiss}
          aria-label="Dispensar"
          className="shrink-0 flex items-center justify-center rounded-lg"
          style={{ width: 48, height: 48, color: 'var(--text-mid)', background: 'transparent', border: 'none' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
