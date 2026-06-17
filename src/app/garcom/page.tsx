import ProtectedRoute from '@/components/ProtectedRoute'
import InstallPrompt from '@/components/InstallPrompt'
import GarcomList from './GarcomList'

export default function GarcomPage() {
  return (
    <ProtectedRoute allow={['admin', 'garcom']}>
      <GarcomList />
      <InstallPrompt />
    </ProtectedRoute>
  )
}
