// src/lib/auto-absent.ts
/**
 * Attendance close service.
 * Morning close marks missing OUT scans.
 * Night close marks missing returns/no attendance.
 */

import prisma from '@/lib/prisma'
import { sendAttendanceNotification } from '@/lib/attendance'
import { ensureTodaySessionExists } from '@/lib/createDailySession'
import { formatClockTime, getCurrentTime, getTodayDate } from '@/lib/utils'

export interface AttendanceCloseResult {
  processed: number
  marked: number
  errors: number
  date: string
  mode: 'morning' | 'night'
}

export type AttendanceCloseMode = 'morning' | 'night'

function getMorningCloseTime(): string {
  return process.env.MORNING_OUT_CLOSE_TIME || '10:00'
}

function getNightCloseTime(): string {
  return process.env.ATTENDANCE_CUTOFF_TIME || process.env.AUTO_ABSENT_TIME || '22:00'
}

function getModeFromCurrentTime(currentTime: string): AttendanceCloseMode {
  return currentTime >= getNightCloseTime() ? 'night' : 'morning'
}

async function upsertAttendanceForStudent(student: any, date: string, data: Record<string, unknown>) {
  const existing = await prisma.attendance.findFirst({
    where: { studentId: student.id, date },
  }) as any

  if (!existing) {
    return (prisma.attendance.create as any)({
      data: {
        studentId: student.id,
        studentName: student.name,
        date,
        ...data,
      },
    })
  }

  return (prisma.attendance.update as any)({
    where: { id: existing.id },
    data: {
      studentName: student.name,
      ...data,
    },
  })
}

export async function runAttendanceCloseChecks(options?: {
  mode?: AttendanceCloseMode
  date?: string
}): Promise<AttendanceCloseResult> {
  const targetDate = options?.date || getTodayDate()
  const currentTime = getCurrentTime()
  const mode = options?.mode || getModeFromCurrentTime(currentTime)

  await ensureTodaySessionExists()

  console.log(`🔄 Running attendance close checks (${mode}) for ${targetDate} at ${currentTime}`)

  let marked = 0
  let errors = 0

  try {
    const allStudents = await (prisma.student.findMany as any)({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    })

    const attendanceRecords = await prisma.attendance.findMany({
      where: { date: targetDate },
      select: {
        id: true,
        studentId: true,
        status: true,
        outTime: true,
        inTime: true,
      } as any,
    }) as any[]

    const recordsByStudent = new Map(attendanceRecords.map((record) => [String(record.studentId), record]))

    for (const student of allStudents as any[]) {
      try {
        const existing = recordsByStudent.get(String(student.id))

        if (mode === 'morning') {
          if (existing?.outTime) {
            continue
          }

          if (existing?.status === 'MORNING OUT NOT MARKED' && !existing?.outTime) {
            continue
          }

          await upsertAttendanceForStudent(student, targetDate, {
            status: 'MORNING OUT NOT MARKED',
            time: null,
            outTime: null,
            inTime: null,
            notes: 'Marked by morning close check',
          })

          await sendAttendanceNotification({
            name: student.name,
            status: 'MORNING OUT NOT MARKED',
            parentPhone: student.parentPhone,
            roomNumber: student.roomNumber,
            date: targetDate,
            time: formatClockTime(getMorningCloseTime()),
          })

          marked++
          console.log(`MORNING OUT NOT MARKED sent for ${student.fingerprintId}`)
          continue
        }

        const hasOut = Boolean(existing?.outTime)
        const hasIn = Boolean(existing?.inTime)

        let newStatus: 'NOT RETURNED' | 'NO ATTENDANCE' | null = null

        if (hasOut && !hasIn) {
          newStatus = 'NOT RETURNED'
        } else if (!hasOut && !hasIn) {
          newStatus = 'NO ATTENDANCE'
        }

        if (!newStatus) {
          continue
        }

        if (existing?.status === newStatus) {
          continue
        }

        await upsertAttendanceForStudent(student, targetDate, {
          status: newStatus,
          time: existing?.time ?? null,
          outTime: existing?.outTime ?? null,
          inTime: existing?.inTime ?? null,
          notes: newStatus === 'NOT RETURNED'
            ? 'Marked by night close check: OUT recorded, IN missing'
            : 'Marked by night close check: no attendance found',
        })

        await sendAttendanceNotification({
          name: student.name,
          status: newStatus,
          parentPhone: student.parentPhone,
          roomNumber: student.roomNumber,
          date: targetDate,
          time: formatClockTime(getNightCloseTime()),
        })

        marked++
        console.log(`${newStatus} marked for ${student.fingerprintId}`)
      } catch (error) {
        errors++
        console.error(`❌ Error marking attendance close status for ${student.name}:`, error)
      }
    }

    return { processed: allStudents.length, marked, errors, date: targetDate, mode }
  } catch (error) {
    console.error('❌ Attendance close job failed:', error)
    throw error
  }
}

export async function runAutoAbsent(date?: string): Promise<AttendanceCloseResult> {
  return runAttendanceCloseChecks({ date })
}
