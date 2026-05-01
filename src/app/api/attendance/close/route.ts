// src/app/api/attendance/close/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthFromRequest } from '@/lib/auth'
import { closeTodaySession, ensureTodaySessionExists } from '@/lib/createDailySession'
import { getTodayDate } from '@/lib/utils'
import { runAttendanceCloseChecks } from '@/lib/auto-absent'

export async function POST(req: NextRequest) {
  const auth = await getAuthFromRequest(req)
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const session = await ensureTodaySessionExists()

    if (session.isClosed) {
      return NextResponse.json(
        { success: false, error: 'Attendance already closed' },
        { status: 409 }
      )
    }

    const closedSession = await closeTodaySession()

    const today = getTodayDate()

    const closeResult = await runAttendanceCloseChecks({ mode: 'night', date: today })

    await (prisma.attendance.updateMany as any)({
      where: { date: today, sessionId: null },
      data: { sessionId: closedSession.id },
    })

    const totalStudents = await (prisma.student.count as any)({ where: { isActive: true } })

    return NextResponse.json({
      success: true,
      message: 'Today\'s attendance closed successfully',
      data: {
        closeResult,
        session: {
          id: closedSession.id,
          date: closedSession.date,
          isClosed: closedSession.isClosed,
          closedAt: closedSession.closedAt,
        },
        totalStudents,
      },
    })
  } catch (error) {
    console.error('POST /api/attendance/close error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to close attendance' },
      { status: 500 }
    )
  }
}
