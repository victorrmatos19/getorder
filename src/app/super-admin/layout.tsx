import ProtectedRoute from '@/components/ProtectedRoute'

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allow={['super_admin']}>
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
        {children}
      </div>
    </ProtectedRoute>
  )
}
