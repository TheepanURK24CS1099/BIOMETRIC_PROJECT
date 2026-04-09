// src/app/api/attendance/route.ts
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthFromRequest } from '@/lib/auth'
import { getTodayDate } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req)
  if (!auth) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') || getTodayDate()
    const studentId = searchParams.get('studentId')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { date }
    if (studentId) where.studentId = studentId
    if (status) where.status = status

    const [records, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: { student: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.attendance.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('GET /api/attendance error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch attendance' }, { status: 500 })
  }
}
