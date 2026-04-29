// src/lib/attendance.ts
import prisma from '@/lib/prisma'
import { ensureTodaySessionExists, getTodaySession } from '@/lib/createDailySession'
import { getCurrentTime, getTodayDate, isLate } from '@/lib/utils'
import { sendAttendanceSMS } from '@/lib/sms'
import { sendAttendanceWhatsApp } from '@/lib/whatsapp'

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

type AttendanceNotificationStudent = {
  name: string
  status: 'PRESENT' | 'ABSENT'
  parentPhone: string
  roomNumber?: string | null
}

export async function sendAttendanceNotification(student: AttendanceNotificationStudent): Promise<void> {
  try {
    console.log('WhatsApp attempt 1...')
    const whatsappAttempt1 = await sendAttendanceWhatsApp(student.name, student.status, student.parentPhone)

    if (whatsappAttempt1) {
      console.log('WhatsApp sent successfully')
      return
    }

    console.log('WhatsApp attempt 1 failed')
    console.log('Retrying WhatsApp in 5 seconds...')
    await new Promise((resolve) => setTimeout(resolve, 5000))

    console.log('WhatsApp attempt 2...')
    const whatsappAttempt2 = await sendAttendanceWhatsApp(student.name, student.status, student.parentPhone)

    if (whatsappAttempt2) {
      console.log('WhatsApp sent successfully')
      return
    }

    console.log('WhatsApp failed twice → sending SMS')
    await sendAttendanceSMS({
      studentName: student.name,
      status: student.status,
      parentPhone: student.parentPhone,
      roomNumber: student.roomNumber ?? undefined,
    })
    console.log('SMS fallback sent')
  } catch (error) {
    console.error('Notification error', error)
    try {
      console.log('WhatsApp failed twice → sending SMS')
      await sendAttendanceSMS({
        studentName: student.name,
        status: student.status,
        parentPhone: student.parentPhone,
        roomNumber: student.roomNumber ?? undefined,
      })
      console.log('SMS fallback sent')
    } catch (smsError) {
      console.error('Notification error', smsError)
    }
  }
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

  return {
    success: true,
    statusCode: 200,
    message: `Attendance marked ${status} for ${student.name}`,
    data: { student, attendance },
  }
}
