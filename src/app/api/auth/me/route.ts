// src/app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req)

  if (!auth) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  }

  return NextResponse.json({
    success: true,
    data: { adminId: auth.adminId, username: auth.username, name: auth.name },
  })
}
