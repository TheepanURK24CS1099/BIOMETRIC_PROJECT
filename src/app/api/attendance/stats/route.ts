// src/app/api/attendance/stats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthFromRequest } from '@/lib/auth'
import { getTodayDate } from '@/lib/utils'
import { getTodaySession } from '@/lib/createDailySession'

function getIndiaDateOffset(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

const FINAL_ABSENT_STATUSES = ['MORNING OUT NOT MARKED', 'NOT RETURNED', 'NO ATTENDANCE', 'ABSENT']

function isMarkedRecord(record: { outTime?: string | null; inTime?: string | null; status?: string | null }): boolean {
  return Boolean(record.outTime || record.inTime || (record.status && ['OUT MARKED', 'IN MARKED', 'PRESENT'].includes(record.status)))
}

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req)
  if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') || getTodayDate()

    const [totalStudents, recentAttendance, allTodayAttendance] = await Promise.all([
      (prisma.student.count as any)({ where: { isActive: true } }),
      (prisma.attendance.findMany as any)({
        where: { date },
        include: { student: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      (prisma.attendance.findMany as any)({
        where: { date },
        select: {
          status: true,
          outTime: true,
          inTime: true,
        },
      }),
    ])

    const presentToday = allTodayAttendance.filter(isMarkedRecord).length
    const absentToday = allTodayAttendance.filter((record) => FINAL_ABSENT_STATUSES.includes(record.status)).length
    const lateToday = allTodayAttendance.filter((record) => record.status === 'LATE').length

    const todaySession = await getTodaySession()

    const attendanceRate =
      totalStudents > 0
        ? Math.round(((presentToday + lateToday) / totalStudents) * 100)
        : 0

    // Weekly trend (last 7 days)
    const weeklyTrend = []
    for (let i = 6; i >= 0; i--) {
      const dateStr = getIndiaDateOffset(-i)
      const [p, a, l] = await Promise.all([
        (prisma.attendance.findMany as any)({
          where: { date: dateStr },
          select: { status: true, outTime: true, inTime: true },
        }).then((rows: Array<{ status: string; outTime: string | null; inTime: string | null }>) => rows.filter(isMarkedRecord).length),
        (prisma.attendance.findMany as any)({
          where: { date: dateStr },
          select: { status: true, outTime: true, inTime: true },
        }).then((rows: Array<{ status: string; outTime: string | null; inTime: string | null }>) => rows.filter((record) => FINAL_ABSENT_STATUSES.includes(record.status)).length),
        (prisma.attendance.count as any)({ where: { date: dateStr, status: 'LATE' } }),
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
