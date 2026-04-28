// src/app/api/attendance/export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthFromRequest } from '@/lib/auth'
import { getTodayDate, formatDate, formatTime } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req)
  if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from') || getTodayDate()
    const to = searchParams.get('to') || getTodayDate()
    const format = searchParams.get('format') || 'csv'

    const records = await prisma.attendance.findMany({
      where: {
        date: { gte: from, lte: to },
      },
      include: { student: true },
      orderBy: [{ date: 'asc' }],
    })

    if (format === 'csv') {
      const headers = ['Date', 'Student Name', 'Room Number', 'Parent Phone', 'Status', 'Time', 'Fingerprint ID']
      const rows = (records as any[]).map((r) => [
        formatDate(new Date(r.date).toISOString().slice(0, 10)),
        r.student.name,
        r.student.roomNumber,
        r.student.parentPhone,
        r.status,
        formatTime(r.time instanceof Date ? r.time.toISOString().slice(11, 19) : r.time),
        r.student.fingerprintId,
      ])

      const csv = [headers, ...rows].map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ).join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="attendance_${from}_to_${to}.csv"`,
        },
      })
    }

    // JSON format
    return NextResponse.json({
      success: true,
      data: records,
      meta: { from, to, total: records.length },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ success: false, error: 'Export failed' }, { status: 500 })
  }
}
