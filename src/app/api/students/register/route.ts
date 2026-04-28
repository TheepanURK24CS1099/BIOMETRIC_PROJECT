// src/app/api/students/register/route.ts
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getAuthFromRequest } from '@/lib/auth'
import { createStudent } from '@/lib/student-service'

export async function POST(req: NextRequest) {
  const auth = await getAuthFromRequest(req)
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { name, roomNumber, parentPhone, fingerprintId } = body as {
      name?: string
      roomNumber?: string
      parentPhone?: string
      fingerprintId?: string
    }

    if (!name || !roomNumber || !parentPhone || !fingerprintId) {
      return NextResponse.json(
        { success: false, error: 'Name, room number, parent phone, and fingerprint ID are required' },
        { status: 400 }
      )
    }

    const student = await createStudent({ name, roomNumber, parentPhone, fingerprintId })

    return NextResponse.json({
      success: true,
      message: 'Student registered successfully',
      data: student,
    }, { status: 201 })
  } catch (error: unknown) {
  if (
    error instanceof PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    return NextResponse.json(
      { success: false, error: 'Fingerprint ID already registered' },
      { status: 409 }
    )
  }

  return NextResponse.json(
    { success: false, error: 'Internal server error' },
    { status: 500 }
  )
}
}
