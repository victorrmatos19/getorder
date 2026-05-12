import ProtectedRoute from '@/components/ProtectedRoute'
import ComandaDetalhe from './ComandaDetalhe'

export default async function ComandaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <ProtectedRoute allow={['admin', 'garcom']}>
      <ComandaDetalhe comandaId={id} />
    </ProtectedRoute>
  )
}
