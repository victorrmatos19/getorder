import ProtectedRoute from '@/components/ProtectedRoute'
import InstallPrompt from '@/components/InstallPrompt'

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allow={['super_admin']}>
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
        {children}
      </div>
      <InstallPrompt />
    </ProtectedRoute>
  )
}
