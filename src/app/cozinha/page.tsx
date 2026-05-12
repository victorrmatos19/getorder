import ProtectedRoute from '@/components/ProtectedRoute'
import CozinhaPanel from './CozinhaPanel'

export default function CozinhaPage() {
  return (
    <ProtectedRoute allow={['admin', 'cozinha']}>
      <CozinhaPanel />
    </ProtectedRoute>
  )
}
