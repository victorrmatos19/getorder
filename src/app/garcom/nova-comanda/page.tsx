import ProtectedRoute from '@/components/ProtectedRoute'
import InstallPrompt from '@/components/InstallPrompt'
import NovaComanda from './NovaComanda'

export default function NovaComandaPage() {
  return (
    <ProtectedRoute allow={['admin', 'garcom']}>
      <NovaComanda />
      <InstallPrompt />
    </ProtectedRoute>
  )
}
