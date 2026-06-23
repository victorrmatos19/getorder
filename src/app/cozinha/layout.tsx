import { RestauranteProvider } from '@/lib/contexts/RestauranteContext'

// Provê o tenant para a cozinha (a marca/cores do restaurante são lidas do contexto).
// A página mantém seu próprio ProtectedRoute/InstallPrompt.
export default function CozinhaLayout({ children }: { children: React.ReactNode }) {
  return <RestauranteProvider>{children}</RestauranteProvider>
}
