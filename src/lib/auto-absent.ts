// src/lib/auto-absent.ts
/**
 * Auto Absent Service
 * Marks all students without attendance for the day as ABSENT
 * Can be triggered by:
 * 1. API endpoint: POST /api/attendance/auto-absent (protected, cron)
 * 2. Vercel Cron Jobs (vercel.json)
 * 3. Node cron job on Render
 */

import prisma from '@/lib/prisma'
import { ensureTodaySessionExists } from '@/lib/createDailySession'
import { sendAttendanceSMS } from '@/lib/sms'
import { sendWhatsApp } from '@/lib/whatsapp'
import { getTodayDate, getCurrentTime } from '@/lib/utils'

export interface AutoAbsentResult {
  processed: number
  marked: number
  errors: number
  date: string
}

export async function runAutoAbsent(date?: string): Promise<AutoAbsentResult> {
  const targetDate = date || getTodayDate()
  const currentTime = getCurrentTime()
  const session = await ensureTodaySessionExists()

  console.log(`🔄 Running auto-absent for date: ${targetDate} at ${currentTime}`)

  let marked = 0
  let errors = 0

  try {
    // Get all active students
    const allStudents = await (prisma.student.findMany as any)({
      where: { isActive: true },
    })

    // Get students who already have attendance today
    const existingAttendance = await prisma.attendance.findMany({
      where: { date: targetDate },
      select: { studentId: true },
    })

    const attendedStudentIds = new Set(existingAttendance.map((a) => a.studentId))

    // Find students without attendance
    const absentStudents = (allStudents as any[]).filter((s: any) => !attendedStudentIds.has(s.id))

    console.log(
      `📊 Total: ${allStudents.length}, Present: ${attendedStudentIds.size}, Absent: ${absentStudents.length}`
    )

    // Mark absent and send notifications
    for (const student of absentStudents) {
      try {
        await prisma.attendance.create({
          data: {
            studentId: student.id,
            date: targetDate,
            status: 'ABSENT',
            time: null,
          },
        })

        await prisma.$executeRaw`
          UPDATE "Attendance"
          SET "studentName" = ${student.name}
          WHERE "studentId" = ${student.id} AND "date" = ${targetDate}
        `

        const whatsappSent = await sendWhatsApp({
          phone: student.parentPhone,
          message: `❌ ${student.name} (Room ${student.roomNumber}) marked ABSENT on ${new Date().toLocaleDateString()}`,
        }).catch((err) => {
          console.error('WhatsApp error:', err)
          return false
        })

        if (!whatsappSent) {
          // Send SMS notification to parent
          await sendAttendanceSMS({
            studentName: student.name,
            roomNumber: student.roomNumber,
            status: 'ABSENT',
            parentPhone: student.parentPhone,
            date: targetDate,
            time: null,
          })
        }

        marked++
        console.log(`✅ Marked absent: ${student.name}`)
      } catch (error) {
        errors++
        console.error(`❌ Error marking absent for ${student.name}:`, error)
      }
    }

    return { processed: absentStudents.length, marked, errors, date: targetDate }
  } catch (error) {
    console.error('❌ Auto-absent job failed:', error)
    throw error
  }
}
