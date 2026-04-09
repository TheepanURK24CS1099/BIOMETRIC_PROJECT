// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

const PUBLIC_PATHS = [
  '/admin/login',
  '/attendance',       // Student-facing scan page is public
  '/api/auth/login',
  '/api/attendance/scan', // Scan endpoint is public (device-level auth)
  '/api/attendance/mark',
  '/_next',
  '/favicon.ico',
  '/uploads',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // If an authenticated user opens the login page, send them to the dashboard.
  if (pathname.startsWith('/admin/login')) {
    const token = req.cookies.get('auth-token')?.value
    if (token) {
      const payload = await verifyToken(token)
      if (payload) {
        return NextResponse.redirect(new URL('/admin/dashboard', req.url))
      }
    }
    return NextResponse.next()
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Protect /admin routes (except login)
  if (pathname.startsWith('/admin')) {
    const token = req.cookies.get('auth-token')?.value

    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', req.url))
    }

    const payload = await verifyToken(token)
    if (!payload) {
      const response = NextResponse.redirect(new URL('/admin/login', req.url))
      response.cookies.delete('auth-token')
      return response
    }
  }

  // Protect /api routes (except above)
  if (pathname.startsWith('/api/') &&
    !pathname.startsWith('/api/auth/login') &&
    !pathname.startsWith('/api/attendance/scan') &&
    !pathname.startsWith('/api/attendance/mark')) {
    const token =
      req.cookies.get('auth-token')?.value ||
      req.headers.get('authorization')?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
