'use client'
// src/components/admin/AdminSidebar.tsx
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import toast from 'react-hot-toast'

interface NavItem {
  href: string
  label: string
  icon: string
}

const SIDEBAR_WIDTH = '280px'

const NAV_ITEMS: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: '◈' },
  { href: '/admin/attendance', label: 'Attendance', icon: '◷' },
  { href: '/admin/device', label: 'Device', icon: '⌘' },
  { href: '/attendance', label: 'Scan Station', icon: '⬡' },
]

export default function AdminSidebar({ adminName }: { adminName: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    localStorage.clear()
    sessionStorage.clear()
    setMobileOpen(false)

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      })
    } catch {
      // Continue to redirect even if the network request fails.
    }

    toast.success('Logged out')
    router.replace('/admin/login')
    router.refresh()
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="shrink-0 p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
            style={{ background: 'linear-gradient(135deg, #c44def, #a92fd2)' }}>
            ⬡
          </div>
          <div>
            <div className="font-display font-700 text-sm text-white leading-tight">Girls Hostel</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Attendance System</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="flex h-11 w-full items-center gap-3 rounded-xl px-4 text-sm font-medium whitespace-nowrap shrink-0 transition-all duration-200"
              style={{
                background: active ? 'rgba(196,77,239,0.12)' : 'transparent',
                color: active ? '#c44def' : 'var(--text-secondary)',
                borderLeft: active ? '2px solid #c44def' : '2px solid transparent',
              }}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center text-base leading-none">
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Admin info + logout */}
      <div className="mt-auto shrink-0 border-t border-white/5 p-4">
        <div className="flex items-center gap-3 mb-3 px-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'linear-gradient(135deg, #c44def, #a92fd2)' }}>
            {adminName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-medium text-white leading-tight">{adminName}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Administrator</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          <span>↩</span>
          Logout
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        <span className="text-white">{mobileOpen ? '✕' : '☰'}</span>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`md:hidden fixed left-0 top-0 bottom-0 z-40 flex flex-col transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{
          width: `min(85vw, ${SIDEBAR_WIDTH})`,
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border)',
        }}
      >
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 z-40 w-[280px] flex-shrink-0"
        style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
      >
        <SidebarContent />
      </aside>
    </>
  )
}
