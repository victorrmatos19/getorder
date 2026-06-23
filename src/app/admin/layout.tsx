import ProtectedRoute from '@/components/ProtectedRoute'
import { RestauranteProvider } from '@/lib/contexts/RestauranteContext'
import InstallPrompt from '@/components/InstallPrompt'
import AdminThemeScope from './AdminThemeScope'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allow={['admin']}>
      <RestauranteProvider>
        <AdminThemeScope>{children}</AdminThemeScope>
      </RestauranteProvider>
      <InstallPrompt />
    </ProtectedRoute>
  )
}
