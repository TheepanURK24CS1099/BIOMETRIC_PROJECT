// src/lib/student-service.ts
import prisma from '@/lib/prisma'

export type CreateStudentInput = {
  name: string
  roomNumber: string
  parentPhone: string
  fingerprintId: string
}

export async function createStudent(input: CreateStudentInput) {
  return prisma.student.create({
    data: {
      name: input.name.trim(),
      roomNumber: input.roomNumber.trim(),
      parentPhone: input.parentPhone.trim(),
      fingerprintId: input.fingerprintId.trim().toUpperCase(),
    },
  })
}

export async function getStudents() {
  return prisma.student.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  })
}