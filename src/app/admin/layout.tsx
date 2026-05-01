// src/app/admin/layout.tsx
import { getServerAuth } from '@/lib/auth'
import AdminSidebar from '@/components/admin/AdminSidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await getServerAuth()

  if (!auth) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <AdminSidebar adminName={auth.name} />
      <main className="min-w-0 flex-1 p-4 pt-20 md:ml-[280px] md:pt-8 lg:p-8">
        {children}
      </main>
    </div>
  )
}
