// src/app/api/attendance/reset-today/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthFromRequest } from '@/lib/auth'
import { ensureTodaySessionExists, reopenTodaySession } from '@/lib/createDailySession'
import { getTodayDate } from '@/lib/utils'

export async function POST(req: NextRequest) {
  const auth = await getAuthFromRequest(req)
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await ensureTodaySessionExists()
    const today = getTodayDate()

    const deletedAttendance = await prisma.attendance.deleteMany({ where: { date: today } })
    const reopenedSession = await reopenTodaySession()

    return NextResponse.json({
      success: true,
      message: 'Today\'s attendance has been reset',
      data: {
        session: {
          id: reopenedSession.id,
          date: reopenedSession.date,
          isClosed: reopenedSession.isClosed,
          closedAt: reopenedSession.closedAt,
        },
        deletedAttendanceCount: deletedAttendance.count,
      },
    })
  } catch (error) {
    console.error('POST /api/attendance/reset-today error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to reset today\'s attendance' },
      { status: 500 }
    )
  }
}