// src/app/api/students/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getAuthFromRequest } from '@/lib/auth'
import { getStudents, createStudent } from '@/lib/student-service'

export async function GET(req: NextRequest) {
  const auth = await getAuthFromRequest(req)
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const students = await getStudents()
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''

    const filteredStudents = search
      ? students.filter((student) =>
          [student.name, student.roomNumber, student.fingerprintId]
            .join(' ')
            .toLowerCase()
            .includes(search.toLowerCase())
        )
      : students

    return NextResponse.json({
      success: true,
      data: filteredStudents,
      total: filteredStudents.length,
      page: 1,
      limit: filteredStudents.length,
      totalPages: 1,
    })
  } catch (error) {
    console.error('GET /api/students error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch students' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthFromRequest(req)
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { name, roomNumber, parentPhone, fingerprintId } = body

    if (!name || !roomNumber || !parentPhone || !fingerprintId) {
      return NextResponse.json(
        { success: false, error: 'Name, room number, parent phone, and fingerprint ID are required' },
        { status: 400 }
      )
    }

    const student = await createStudent({ name, roomNumber, parentPhone, fingerprintId })

    return NextResponse.json({ success: true, data: student, message: 'Student registered successfully' }, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ success: false, error: 'Fingerprint ID already registered' }, { status: 409 })
    }
    console.error('POST /api/students error:', error)
    return NextResponse.json({ success: false, error: 'Failed to register student' }, { status: 500 })
  }
}
