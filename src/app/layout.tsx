import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Work_Sans } from 'next/font/google'
import QueryProvider from '@/components/providers/QueryProvider'
import './globals.css'

const serif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-serif',
  display: 'swap',
})

const sans = Work_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'GetOrder — Comandas digitais',
  description: 'Comandas digitais por QR Code.',
  manifest: '/manifest.webmanifest',
  // iOS: abre em tela cheia quando adicionado à Tela de Início. O convite visível, porém,
  // só aparece no staff (InstallPrompt) — o cliente em /mesa usa como site normal.
  appleWebApp: {
    capable: true,
    title: 'GetOrder',
    statusBarStyle: 'default',
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#4A5240',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
