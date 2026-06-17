import ProtectedRoute from '@/components/ProtectedRoute'
import { RestauranteProvider } from '@/lib/contexts/RestauranteContext'
import InstallPrompt from '@/components/InstallPrompt'
import AdminNav from './AdminNav'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allow={['admin']}>
      <RestauranteProvider>
        <div className="min-h-screen flex flex-col pb-20" style={{ background: 'var(--bg)' }}>
          {children}
          <AdminNav />
        </div>
      </RestauranteProvider>
      <InstallPrompt />
    </ProtectedRoute>
  )
}
