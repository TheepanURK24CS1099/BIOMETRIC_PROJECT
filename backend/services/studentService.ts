import prisma from '../db'

export type CreateStudentInput = {
  name: string
  fingerprintId: string
  parentPhone: string
}

export async function createStudent(input: CreateStudentInput) {
  return prisma.student.create({
    data: {
      name: input.name.trim(),
      fingerprintId: input.fingerprintId.trim().toUpperCase(),
      parentPhone: input.parentPhone.trim(),
    },
  })
}

export async function getStudents() {
  return prisma.student.findMany({
    orderBy: { createdAt: 'desc' },
  })
}
