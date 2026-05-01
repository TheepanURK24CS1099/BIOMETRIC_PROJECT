// src/lib/sms.ts
/**
 * SMS Notification Service
 *
 * Step 1: Read configuration from environment variables.
 * Step 2: Use Fast2SMS when SMS_PROVIDER is set to "fast2sms".
 * Step 3: Fall back to mock console logging for non-production/testing use.
 */

import prisma from '@/lib/prisma'
import { formatClockTime } from '@/lib/utils'

export interface SMSResult {
  success: boolean
  messageId?: string
  error?: string
  provider: string
}

export interface AttendanceSMSData {
  studentName: string
  status: string
  parentPhone: string
  roomNumber?: string
  date?: string
  time?: string | null
}

function buildMessage(studentName: string, status: string): string {
  return `Hostel Attendance Update:\n${studentName} is marked ${status} today.`
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^91/, '')
}

async function logNotification(params: {
  studentName: string
  phone: string
  message: string
  status: 'sent' | 'failed' | 'pending'
  provider: string
}) {
  try {
    await prisma.$executeRaw`
      INSERT INTO "NotificationLog" (
        "id",
        "studentName",
        "phone",
        "message",
        "status",
        "provider",
        "createdAt"
      ) VALUES (
        ${crypto.randomUUID()},
        ${params.studentName},
        ${params.phone},
        ${params.message},
        ${params.status},
        ${params.provider},
        ${new Date()}
      )
    `
  } catch (error) {
    console.error('Failed to write notification log:', error)
  }
}

async function sendViaFast2SMS(phone: string, message: string): Promise<SMSResult> {
  // Step 4: Require the API key before calling Fast2SMS.
  const apiKey = process.env.FAST2SMS_API_KEY

  if (!apiKey) {
    console.error('FAST2SMS_API_KEY is missing')
    return { success: false, error: 'FAST2SMS_API_KEY not configured', provider: 'fast2sms' }
  }

  try {
    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: 'q',
        message,
        language: 'english',
        flash: 0,
        numbers: normalizePhone(phone),
      }),
    })

    const result: unknown = await response.json()
    const payload = result as { return?: boolean; request_id?: string; message?: string }

    if (!response.ok || payload.return !== true) {
      console.error('Fast2SMS failed:', payload.message || response.statusText)
      return { success: false, error: payload.message || 'Fast2SMS error', provider: 'fast2sms' }
    }

    console.log('Fast2SMS sent successfully to', phone)
    return { success: true, messageId: payload.request_id, provider: 'fast2sms' }
  } catch (error) {
    console.error('Fast2SMS request failed:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error), provider: 'fast2sms' }
  }
}

async function sendViaMock(phone: string, message: string): Promise<SMSResult> {
  // Step 5: Keep a safe fallback path for development and testing.
  console.log('\n📱 [SMS Mock] ─────────────────────────────')
  console.log(`To: ${phone}`)
  console.log(`Message: ${message}`)
  console.log('─────────────────────────────────────────\n')

  await new Promise((resolve) => setTimeout(resolve, 100))
  return { success: true, messageId: `mock-${Date.now()}`, provider: 'mock' }
}

export async function sendAttendanceSMS(data: AttendanceSMSData): Promise<SMSResult>
export async function sendAttendanceSMS(studentName: string, status: string, phone: string): Promise<SMSResult>
export async function sendAttendanceSMS(
  studentName: string | AttendanceSMSData,
  status?: string,
  phone?: string
): Promise<SMSResult> {
  const data: AttendanceSMSData = typeof studentName === 'string'
    ? { studentName, status: status || 'ABSENT', parentPhone: phone || '' }
    : studentName

  const dateText = data.date || new Date().toISOString().split('T')[0]
  const timeText = data.time ? formatClockTime(data.time) : formatClockTime(new Date().toTimeString().slice(0, 8))
  const message = `${buildMessage(data.studentName, data.status)}\nDate: ${dateText}\nTime: ${timeText}`

  // Step 6: Route to Fast2SMS only when explicitly enabled.
  const provider = process.env.SMS_PROVIDER || 'mock'

  const result = provider === 'fast2sms'
    ? await sendViaFast2SMS(data.parentPhone, message)
    : await sendViaMock(data.parentPhone, message)

  await logNotification({
    studentName: data.studentName,
    phone: data.parentPhone,
    message,
    status: result.success ? 'sent' : 'failed',
    provider: result.provider,
  })

  return result
}
