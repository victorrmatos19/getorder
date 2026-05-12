import ProtectedRoute from '@/components/ProtectedRoute'
import GarcomList from './GarcomList'

export default function GarcomPage() {
  return (
    <ProtectedRoute allow={['admin', 'garcom']}>
      <GarcomList />
    </ProtectedRoute>
  )
}
