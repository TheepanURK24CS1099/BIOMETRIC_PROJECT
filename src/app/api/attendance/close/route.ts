// src/app/api/attendance/close/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthFromRequest } from '@/lib/auth'
import { closeTodaySession, ensureTodaySessionExists } from '@/lib/createDailySession'
import { getTodayDate } from '@/lib/utils'
import { sendAttendanceWhatsApp } from '@/lib/whatsapp'
import { sendAttendanceSMS } from '@/lib/sms'

type NotificationStudent = {
  id: string
  name: string
  parentPhone: string
}

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

    await (prisma.attendance.updateMany as any)({
      where: { date: today, sessionId: null },
      data: { sessionId: closedSession.id },
    })

    const [students, todayAttendance] = await Promise.all([
      (prisma.student.findMany as any)({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          parentPhone: true,
        },
      }) as unknown as Promise<NotificationStudent[]>,
      (prisma.attendance.findMany as any)({
        where: { date: today },
        select: { studentId: true, status: true, sessionId: true },
      }),
    ])

    const attendanceMap = new Map<string, 'PRESENT' | 'ABSENT' | 'LATE'>()
    const autoAbsentStudentIds = new Set<string>()
    for (const record of todayAttendance) {
      attendanceMap.set(String(record.studentId), record.status as 'PRESENT' | 'ABSENT' | 'LATE')
    }

    for (const student of students) {
      if (!attendanceMap.has(student.id)) {
        await (prisma.attendance.create as any)({
          data: {
            studentId: student.id,
            date: today,
            status: 'ABSENT',
            time: null,
            notes: 'Auto-marked absent when attendance was closed',
            sessionId: closedSession.id,
          },
        })
        await prisma.$executeRaw`
          UPDATE "Attendance"
          SET "studentName" = ${student.name}
          WHERE "studentId" = ${student.id} AND "date" = ${today}
        `
        attendanceMap.set(String(student.id), 'ABSENT')
        autoAbsentStudentIds.add(String(student.id))
      }
    }

    const notificationResults: Array<{
      studentId: string
      name: string
      status: 'PRESENT' | 'ABSENT' | 'LATE'
      success: boolean
      provider: string
      error?: string
    }> = []

    for (const student of students) {
      const status = attendanceMap.get(student.id) ?? 'ABSENT'

      if (!autoAbsentStudentIds.has(student.id)) {
        continue
      }

      try {
        const whatsappSent = await sendAttendanceWhatsApp(student.name, status, student.parentPhone)

        if (whatsappSent) {
          notificationResults.push({
            studentId: student.id,
            name: student.name,
            status,
            success: true,
            provider: 'fast2sms-whatsapp',
          })
        } else {
          console.log('⚠ WhatsApp failed → SMS fallback')
          const result = await sendAttendanceSMS({
            studentName: student.name,
            status,
            parentPhone: student.parentPhone,
            date: today,
          })

          notificationResults.push({
            studentId: student.id,
            name: student.name,
            status,
            success: result.success,
            provider: result.provider,
            error: result.error,
          })

          if (result.success) {
            console.log('✅ SMS sent')
          } else {
            console.log('⚠ SMS failed')
          }
        }
      } catch (error) {
        console.error(`SMS error for ${student.name}:`, error)
        notificationResults.push({
          studentId: student.id,
          name: student.name,
          status,
          success: false,
          provider: 'fast2sms',
          error: error instanceof Error ? error.message : 'Unknown SMS error',
        })
      }

      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    return NextResponse.json({
      success: true,
      message: 'Today\'s attendance closed successfully',
      data: {
        session: {
          id: closedSession.id,
          date: closedSession.date,
          isClosed: closedSession.isClosed,
          closedAt: closedSession.closedAt,
        },
        totalStudents: students.length,
        notificationsSent: notificationResults.filter((item) => item.success).length,
        notificationResults,
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
