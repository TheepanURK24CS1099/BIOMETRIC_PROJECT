// src/lib/attendance.ts
import prisma from '@/lib/prisma'
import { ensureTodaySessionExists, getTodaySession } from '@/lib/createDailySession'
import { formatClockTime, getCurrentTime, getTodayDate } from '@/lib/utils'
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

type AttendanceNotificationStatus =
  | 'OUT from hostel'
  | 'IN to hostel'
  | 'MORNING OUT NOT MARKED'
  | 'NOT RETURNED'
  | 'NO ATTENDANCE'

type AttendanceNotificationStudent = {
  name: string
  status: AttendanceNotificationStatus
  parentPhone: string
  roomNumber?: string | null
  date?: string
  time?: string
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
    const whatsappSent = await sendAttendanceWhatsApp({
      parentName: 'Parent',
      studentName: student.name,
      status: student.status,
      date: student.date || getTodayDate(),
      time: student.time || formatClockTime(getCurrentTime()),
      phone: student.parentPhone,
    })

    if (whatsappSent) {
      console.log('WhatsApp sent')
      return
    }

    const smsResult = await sendAttendanceSMS({
      studentName: student.name,
      status: student.status,
      parentPhone: student.parentPhone,
      roomNumber: student.roomNumber ?? undefined,
      date: student.date || getTodayDate(),
      time: student.time || getCurrentTime(),
    })

    if (smsResult.success) {
      console.log('WhatsApp failed, SMS fallback sent')
    } else {
      console.log('WhatsApp failed, SMS fallback failed')
    }
  } catch (error) {
    console.error('Notification error', error)
  }
}

function getScanTimeValue(): string {
  return getCurrentTime()
}

function isFinalStatus(status?: string | null): boolean {
  return Boolean(status && ['NOT RETURNED', 'NO ATTENDANCE'].includes(status))
}

function isDuplicateFinalRecord(attendance: { outTime?: string | null; inTime?: string | null; status?: string | null }): boolean {
  return Boolean(attendance.outTime && attendance.inTime)
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

  await ensureTodaySessionExists()
  const currentSession = await getTodaySession()
  if (currentSession?.isClosed) {
    return { success: false, statusCode: 403, error: 'Attendance already closed' }
  }

  const todayDate = getTodayDate()
  const currentTime = getScanTimeValue()

  const existing = (await prisma.attendance.findFirst({
    where: {
      studentId: student.id,
      date: todayDate,
    },
  })) as any

  if (existing && isDuplicateFinalRecord(existing)) {
    console.log(`Duplicate scan prevented for ${student.fingerprintId}`)
    return {
      success: true,
      statusCode: 200,
      message: 'Morning OUT and evening IN already marked today.',
      data: {
        student,
        attendance: existing,
      },
    }
  }

  const scanStatus: AttendanceNotificationStatus = !existing || !existing.outTime ? 'OUT from hostel' : 'IN to hostel'

  let attendance

  if (!existing) {
    attendance = await (prisma.attendance.create as any)({
      data: {
        studentId: student.id,
        studentName: student.name,
        date: todayDate,
        status: 'OUT MARKED',
        time: currentTime,
        outTime: currentTime,
      },
    })
    console.log(`OUT marked for fingerprintId ${normalizedFingerprintId}`)
  } else if (!existing.outTime) {
    attendance = await (prisma.attendance.update as any)({
      where: { id: existing.id },
      data: {
        studentName: student.name,
        status: 'OUT MARKED',
        time: currentTime,
        outTime: currentTime,
      },
    })
    console.log(`OUT marked for fingerprintId ${normalizedFingerprintId}`)
  } else {
    attendance = await (prisma.attendance.update as any)({
      where: { id: existing.id },
      data: {
        studentName: student.name,
        status: 'IN MARKED',
        time: currentTime,
        inTime: currentTime,
      },
    })
    console.log(`IN marked for fingerprintId ${normalizedFingerprintId}`)
  }

  return {
    success: true,
    statusCode: 200,
    message: scanStatus === 'OUT from hostel'
      ? `OUT marked for ${student.name}`
      : `IN marked for ${student.name}`,
    data: { student, attendance },
  }
}
