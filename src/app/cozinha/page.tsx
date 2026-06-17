import ProtectedRoute from '@/components/ProtectedRoute'
import InstallPrompt from '@/components/InstallPrompt'
import CozinhaPanel from './CozinhaPanel'

export default function CozinhaPage() {
  return (
    <ProtectedRoute allow={['admin', 'cozinha']}>
      <CozinhaPanel />
      <InstallPrompt />
    </ProtectedRoute>
  )
}
