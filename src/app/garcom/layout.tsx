import { RestauranteProvider } from '@/lib/contexts/RestauranteContext'
import GarcomThemeScope from './GarcomThemeScope'

// Provê o tenant (restauranteId/role) para as telas do garçom — necessário para
// /garcom/nova-comanda (mesas livres) e /garcom/pedido (produtos/adicionais).
// O GarcomThemeScope aplica a marca (cores) do restaurante. As páginas mantêm seu
// próprio ProtectedRoute/InstallPrompt.
export default function GarcomLayout({ children }: { children: React.ReactNode }) {
  return (
    <RestauranteProvider>
      <GarcomThemeScope>{children}</GarcomThemeScope>
    </RestauranteProvider>
  )
}
