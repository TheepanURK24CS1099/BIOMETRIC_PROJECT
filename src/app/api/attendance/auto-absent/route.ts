// src/app/api/attendance/auto-absent/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthFromRequest } from '@/lib/auth'
import { closeTodaySession, ensureTodaySessionExists } from '@/lib/createDailySession'
import { getTodayDate } from '@/lib/utils'
import { runAutoAbsent } from '@/lib/auto-absent'

/**
 * POST /api/attendance/auto-absent
 * Trigger auto-absent marking. Protected endpoint.
 * Can be called by:
 * - Vercel Cron (add to vercel.json)
 * - External cron service
 * - Manual trigger from admin panel
 */
export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret')
  if (cronSecret && cronSecret === process.env.CRON_SECRET) {
    // allow cron
  } else {
    // existing admin auth check
    const auth = await getAuthFromRequest(request)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const body = await request.json().catch(() => ({}))
    const date = body.date || undefined

    const result = await runAutoAbsent(date)

    if (result.mode === 'night') {
      await ensureTodaySessionExists()
      const closedSession = await closeTodaySession()

      await (prisma.attendance.updateMany as any)({
        where: { date: date || getTodayDate(), sessionId: null },
        data: { sessionId: closedSession.id },
      })
    }

    return NextResponse.json({
      success: true,
      message: result.mode === 'night'
        ? `Night close completed. Marked ${result.marked} students with final status.`
        : `Morning close completed. Marked ${result.marked} students with morning status.`,
      data: result,
    })
  } catch (error) {
    console.error('Auto-absent error:', error)
    return NextResponse.json({ success: false, error: 'Auto-absent job failed' }, { status: 500 })
  }
}
