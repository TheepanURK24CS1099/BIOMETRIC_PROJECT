import { NextRequest, NextResponse } from 'next/server'
import { markAttendanceByFingerprint } from '@/lib/attendance'

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
