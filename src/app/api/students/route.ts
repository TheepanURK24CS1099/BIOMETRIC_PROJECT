import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const students = await prisma.student.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: students,
    })
  } catch (error) {
    console.error('GET /api/students error:', error)

    return NextResponse.json(
      { success: false, error: 'Failed to load students' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, roomNumber, parentPhone, fingerprintId } = body

    if (!name || !roomNumber || !parentPhone || !fingerprintId) {
      return NextResponse.json(
        { success: false, error: 'All fields are required' },
        { status: 400 }
      )
    }

    const student = await prisma.student.create({
      data: {
        name,
        roomNumber,
        parentPhone,
        fingerprintId,
        isActive: true,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: student,
        message: 'Student registered successfully',
      },
      { status: 201 }
    )
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

    console.error('POST /api/students error:', error)

    return NextResponse.json(
      { success: false, error: 'Failed to register student' },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200 })
}

export async function HEAD() {
  return new Response(null, { status: 200 })
}
