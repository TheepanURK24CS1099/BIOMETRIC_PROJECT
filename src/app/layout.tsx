// src/app/layout.tsx
import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'
import '@/lib/server-init'

export const metadata: Metadata = {
  title: 'Girls Hostel Attendance System',
  description: 'Biometric attendance management system for girls hostel',
  manifest: '/manifest.json',
  themeColor: '#060b18',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="noise">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1a2340',
              color: '#f1f5f9',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              fontFamily: 'DM Sans, sans-serif',
            },
            success: {
              iconTheme: { primary: '#10b981', secondary: '#060b18' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#060b18' },
            },
          }}
        />
      </body>
    </html>
  )
}
