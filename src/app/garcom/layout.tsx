import { RestauranteProvider } from '@/lib/contexts/RestauranteContext'

// Provê o tenant (restauranteId/role) para as telas do garçom — necessário para
// /garcom/nova-comanda (mesas livres) e /garcom/pedido (produtos/adicionais).
// As páginas mantêm seu próprio ProtectedRoute/InstallPrompt.
export default function GarcomLayout({ children }: { children: React.ReactNode }) {
  return <RestauranteProvider>{children}</RestauranteProvider>
}
