import ProtectedRoute from '@/components/ProtectedRoute'
import InstallPrompt from '@/components/InstallPrompt'
import PedidoGarcom from './PedidoGarcom'

export default async function PedidoGarcomPage({
  searchParams,
}: {
  searchParams: Promise<{ mesa?: string; comanda?: string }>
}) {
  const sp = await searchParams
  return (
    <ProtectedRoute allow={['admin', 'garcom']}>
      <PedidoGarcom mesaId={sp.mesa ?? null} comandaId={sp.comanda ?? null} />
      <InstallPrompt />
    </ProtectedRoute>
  )
}
