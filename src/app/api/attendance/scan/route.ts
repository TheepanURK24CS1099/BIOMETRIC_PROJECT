import { NextRequest, NextResponse } from 'next/server'
import { markAttendanceByFingerprint } from '@/lib/attendance'
import { sendAttendanceSMS } from '@/lib/sms'
import { sendWhatsApp } from '@/lib/whatsapp'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { fingerprintId } = body

    if (!fingerprintId) {
      return NextResponse.json(
        { success: false, error: 'Fingerprint ID is required' },
        { status: 400 }
      )
    }

    const result = await markAttendanceByFingerprint(fingerprintId)

    if (result.success && result.data?.student && result.data?.attendance) {
      const { student, attendance } = result.data
      const status = attendance.status

      if (status === 'PRESENT') {
        const whatsappSent = await sendWhatsApp({
          phone: student.parentPhone,
          message: `✅ ${student.name} (Room ${student.roomNumber}) marked PRESENT on ${new Date().toLocaleDateString()}`,
        }).catch((err) => {
          console.error('WhatsApp error:', err)
          return false
        })

        if (!whatsappSent) {
          console.log('⚠ WhatsApp failed → SMS fallback')
          const smsResult = await sendAttendanceSMS({
            studentName: student.name,
            status: 'PRESENT',
            parentPhone: student.parentPhone,
            date: new Date().toISOString().split('T')[0],
            time: null,
          })

          if (smsResult.success) {
            console.log('✅ SMS sent')
          } else {
            console.log('⚠ SMS failed')
          }
        }
      }
    }

    // ✅ SUCCESS CASE
    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          message: result.message,
          data: result.data
        },
        { status: result.statusCode }
      )
    }

    // ❌ FAILURE CASE (TYPE-SAFE FIX)
    return NextResponse.json(
      {
        success: false,
        error: 'error' in result ? result.error : 'Failed to mark attendance',
        data: result.data ?? null
      },
      { status: result.statusCode }
    )

  } catch (error) {
    console.error('POST /api/attendance/scan error:', error)

    return NextResponse.json(
      { success: false, error: 'Failed to mark attendance' },
      { status: 500 }
    )
  }
}
