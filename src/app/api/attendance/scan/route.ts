// src/app/api/attendance/scan/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { markAttendanceByFingerprint } from '@/lib/attendance'

/**
 * POST /api/attendance/scan
 * Simulates biometric fingerprint scan.
 * Body: { fingerprintId: string }
 * 
 * When real hardware is integrated, replace fingerprintId input 
 * with SDK-returned fingerprint template/ID from the scanner.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { fingerprintId } = body

    const result = await markAttendanceByFingerprint(fingerprintId)

    return NextResponse.json(
      result.success
        ? { success: true, message: result.message, data: result.data }
        : { success: false, error: result.error, data: result.data },
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
