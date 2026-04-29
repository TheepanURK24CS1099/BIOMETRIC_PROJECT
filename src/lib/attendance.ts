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

function normalizeFingerprintId(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : ''
}

function isValidParentPhone(phone: string | null | undefined): boolean {
  const normalized = typeof phone === 'string' ? phone.trim() : ''
  if (!normalized || normalized.toUpperCase() === 'UNKNOWN') return false

  const digits = normalized.replace(/\D/g, '')
  return digits.length >= 10
}

async function getOrCreateStudentByFingerprint(fingerprintId: string) {
  const existingStudent = await prisma.student.findFirst({
    where: { fingerprintId },
  })

  if (existingStudent) {
    console.log(`Existing student found for fingerprintId: ${fingerprintId}`)
    return existingStudent
  }

  try {
    const placeholderStudent = await prisma.student.create({
      data: {
        name: `Unknown Student ${fingerprintId}`,
        roomNumber: 'UNKNOWN',
        parentPhone: 'UNKNOWN',
        fingerprintId,
        fp_id: fingerprintId,
        device_user_id: fingerprintId,
        isActive: true,
      },
    })

    console.log(`Auto-created student from device: ${fingerprintId}`)
    return placeholderStudent
  } catch (error: unknown) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code : undefined

    if (code === 'P2002') {
      const student = await prisma.student.findFirst({
        where: { fingerprintId },
      })

      if (student) {
        console.log(`Existing student found for fingerprintId: ${fingerprintId}`)
        return student
      }
    }

    throw error
  }
}

export async function sendAttendanceNotification(student: AttendanceNotificationStudent): Promise<void> {
  if (!isValidParentPhone(student.parentPhone)) {
    console.log('Notification skipped: missing parent phone')
    return
  }

  try {
    const whatsappSent = await sendAttendanceWhatsApp(student.name, student.status, student.parentPhone)

    if (whatsappSent) {
      console.log('WhatsApp sent successfully')
      return
    }

    console.log('WhatsApp failed → sending SMS fallback')
    const smsResult = await sendAttendanceSMS({
      studentName: student.name,
      status: student.status,
      parentPhone: student.parentPhone,
      roomNumber: student.roomNumber ?? undefined,
    })

    if (smsResult.success) {
      console.log('SMS fallback sent')
    }
  } catch (error) {
    console.error('Notification error', error)
  }
}

/**
 * Shared attendance marking logic used by both /api/attendance/scan and /api/attendance/mark.
 */
export async function markAttendanceByFingerprint(fingerprintId: string | null | undefined): Promise<AttendanceMarkResult> {
  const normalizedFingerprintId = normalizeFingerprintId(fingerprintId)

  if (!normalizedFingerprintId) {
    return { success: false, statusCode: 400, error: 'Fingerprint ID is required' }
  }

  const student = await getOrCreateStudentByFingerprint(normalizedFingerprintId)

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

      console.log(`Marked attendance for fingerprintId: ${normalizedFingerprintId}`)

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

  console.log(`Marked attendance for fingerprintId: ${normalizedFingerprintId}`)

  return {
    success: true,
    statusCode: 200,
    message: `Attendance marked ${status} for ${student.name}`,
    data: { student, attendance },
  }
}
