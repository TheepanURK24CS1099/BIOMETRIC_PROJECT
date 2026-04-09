import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { getAuthFromRequest } from '@/lib/auth'

type RouteContext = {
  params: { id: string }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const auth = await getAuthFromRequest(req)
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const id = params?.id?.trim()
  if (!id) {
    return NextResponse.json({ success: false, error: 'Student ID is required' }, { status: 400 })
  }

  try {
    const student = await prisma.student.findUnique({
      where: { id },
      select: { id: true, name: true },
    })

    if (!student) {
      return NextResponse.json({ success: false, error: 'Student not found' }, { status: 404 })
    }

    await prisma.$transaction([
      prisma.attendance.deleteMany({ where: { studentId: id } }),
      prisma.student.delete({ where: { id } }),
    ])

    return NextResponse.json({
      success: true,
      message: `Student ${student.name} deleted successfully`,
      data: { id, name: student.name },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ success: false, error: 'Student not found' }, { status: 404 })
    }

    console.error('DELETE /api/students/[id] error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete student' }, { status: 500 })
  }
}
