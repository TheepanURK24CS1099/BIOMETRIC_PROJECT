// src/lib/student-service.ts
import prisma from '@/lib/prisma'

export type CreateStudentInput = {
  name: string
  roomNumber: string
  parentPhone: string
  fingerprintId?: string
}

const FINGERPRINT_PREFIX = 'FF'

function normalizeFingerprintId(value?: string | null): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : ''
}

function formatFingerprintId(sequence: number): string {
  return `${FINGERPRINT_PREFIX}${String(sequence).padStart(3, '0')}`
}

async function getHighestFingerprintSequence(): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ maxSequence: number | null }>>`
    SELECT MAX(CAST(SUBSTRING("fingerprintId" FROM 3) AS INTEGER)) AS "maxSequence"
    FROM "Student"
    WHERE "fingerprintId" ~ '^FF[0-9]+$'
  `

  return Number(rows?.[0]?.maxSequence || 0)
}

async function generateNextFingerprintId(): Promise<string> {
  const nextSequence = (await getHighestFingerprintSequence()) + 1
  return formatFingerprintId(nextSequence)
}

export async function createStudent(input: CreateStudentInput) {
  const data = {
    name: input.name.trim(),
    roomNumber: input.roomNumber.trim(),
    parentPhone: input.parentPhone.trim(),
  }

  const manualFingerprintId = normalizeFingerprintId(input.fingerprintId)
  let fingerprintId = manualFingerprintId

  for (let attempt = 0; attempt < 5; attempt++) {
    if (!fingerprintId) {
      fingerprintId = await generateNextFingerprintId()
      console.log(`Generated fingerprintId: ${fingerprintId}`)
    }

    try {
      return await prisma.student.create({
        data: {
          ...data,
          fingerprintId,
        },
      })
    } catch (error: unknown) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code : undefined

      if (code === 'P2002' && !manualFingerprintId) {
        fingerprintId = ''
        continue
      }

      throw error
    }
  }

  throw new Error('Failed to generate a unique fingerprint ID')
}

export async function getStudents() {
  return (prisma.student.findMany as any)({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  })
}