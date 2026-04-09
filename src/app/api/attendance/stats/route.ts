// src/app/api/attendance/stats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthFromRequest } from '@/lib/auth'
import { getTodayDate } from '@/lib/utils'
import { getTodaySession } from '@/lib/createDailySession'

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req)
  if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') || getTodayDate()

    const [totalStudents, presentToday, absentToday, lateToday, recentAttendance] =
      await Promise.all([
        prisma.student.count({ where: { isActive: true } }),
        prisma.attendance.count({ where: { date, status: 'PRESENT' } }),
        prisma.attendance.count({ where: { date, status: 'ABSENT' } }),
        prisma.attendance.count({ where: { date, status: 'LATE' } }),
        prisma.attendance.findMany({
          where: { date },
          include: { student: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ])

    const todaySession = await getTodaySession()

    const attendanceRate =
      totalStudents > 0
        ? Math.round(((presentToday + lateToday) / totalStudents) * 100)
        : 0

    // Weekly trend (last 7 days)
    const weeklyTrend = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const [p, a, l] = await Promise.all([
        prisma.attendance.count({ where: { date: dateStr, status: 'PRESENT' } }),
        prisma.attendance.count({ where: { date: dateStr, status: 'ABSENT' } }),
        prisma.attendance.count({ where: { date: dateStr, status: 'LATE' } }),
      ])
      weeklyTrend.push({ date: dateStr, present: p, absent: a, late: l })
    }

    return NextResponse.json({
      success: true,
      data: {
        totalStudents,
        presentToday,
        absentToday,
        lateToday,
        attendanceRate,
        recentAttendance,
        weeklyTrend,
        date,
        todaySession: todaySession
          ? { isClosed: todaySession.isClosed, closedAt: todaySession.closedAt }
          : null,
      },
    })
  } catch (error) {
    console.error('GET /api/attendance/stats error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 })
  }
}
