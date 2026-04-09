// src/lib/attendance.ts
import prisma from '@/lib/prisma'
import { ensureTodaySessionExists, getTodaySession } from '@/lib/createDailySession'
import { getCurrentTime, getTodayDate, isLate } from '@/lib/utils'
import { sendAttendanceWhatsApp } from '@/lib/whatsapp'
import { sendAttendanceSMS } from '@/lib/sms'

type AttendanceMarkResult =
  | {
      success: true
      statusCode: number
      message: string
      data: {
        student: Awaited<ReturnType<typeof prisma.student.findFirst>>
        attendance: Awaited<ReturnType<typeof prisma.attendance.create>>
      }
    }
  | {
      success: false
      statusCode: number
      error: string
      data?: Record<string, unknown>
    }

/**
 * Shared attendance marking logic used by both /api/attendance/scan and /api/attendance/mark.
 */
export async function markAttendanceByFingerprint(fingerprintId: string | null | undefined): Promise<AttendanceMarkResult> {
  const normalizedFingerprintId = typeof fingerprintId === 'string' ? fingerprintId.trim().toUpperCase() : ''

  if (!normalizedFingerprintId) {
    return { success: false, statusCode: 400, error: 'Fingerprint ID is required' }
  }

  const student = await prisma.student.findFirst({
    where: { fingerprintId: normalizedFingerprintId } as any,
  })

  if (!student) {
    return { success: false, statusCode: 404, error: 'Fingerprint not recognized. Student not found.' }
  }

  const session = await ensureTodaySessionExists()
  const currentSession = await getTodaySession()
  if (currentSession?.isClosed) {
    return { success: false, statusCode: 403, error: 'Attendance already closed' }
  }

  const today = getTodayDate()
  const currentTime = getCurrentTime()

  const existingRecord = await prisma.attendance.findFirst({
    where: { studentId: student.id, date: today } as any,
  })

  async function sendNotification(statusToSend: 'PRESENT' | 'ABSENT' | 'LATE', studentName: string, parentPhone: string) {
    const whatsappSent = await sendAttendanceWhatsApp(studentName, statusToSend, parentPhone)

    if (whatsappSent) {
      return
    }

    console.log('⚠ WhatsApp failed → SMS fallback')
    const smsResult = await sendAttendanceSMS({
      studentName,
      status: statusToSend,
      parentPhone,
      date: today,
      time: currentTime,
    })

    if (smsResult.success) {
      console.log('✅ SMS sent')
    } else {
      console.log('⚠ SMS failed')
    }
  }

  if (existingRecord) {
    if (existingRecord.status === 'ABSENT') {
      const correctedAttendance = await prisma.attendance.update({
        where: { id: existingRecord.id },
        data: {
          status: 'PRESENT' as any,
          time: currentTime,
        },
      })

      await prisma.$executeRaw`
        UPDATE "Attendance"
        SET "studentName" = ${student.name}
        WHERE "id" = ${correctedAttendance.id}
      `

      void sendNotification('PRESENT', student.name, student.parentPhone).catch((error) =>
        console.error('Notification send failed:', error)
      )

      return {
        success: true,
        statusCode: 200,
        message: `Attendance corrected to PRESENT for ${student.name}`,
        data: { student, attendance: correctedAttendance },
      }
    }

    return {
      success: false,
      statusCode: 409,
      error: 'Attendance already marked for today',
      data: {
        student,
        attendance: existingRecord,
        alreadyMarked: true,
      },
    }
  }

  const status = isLate(currentTime) ? 'LATE' : 'PRESENT'

  const attendance = await prisma.attendance.create({
    data: {
      studentId: student.id,
      date: today,
      status: status as any,
      time: currentTime,
    },
  })

  await prisma.$executeRaw`
    UPDATE "Attendance"
    SET "studentName" = ${student.name}
    WHERE "id" = ${attendance.id}
  `

  void sendNotification(status, student.name, student.parentPhone).catch((error) =>
    console.error('Notification send failed:', error)
  )

  return {
    success: true,
    statusCode: 200,
    message: `Attendance marked ${status} for ${student.name}`,
    data: { student, attendance },
  }
}
