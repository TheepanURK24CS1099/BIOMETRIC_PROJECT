// src/lib/createDailySession.ts
import prisma from '@/lib/prisma'

export interface AttendanceSessionRecord {
  id: string
  date: string
  isClosed: boolean
  closedAt: string | null
  createdAt: string
}

const SESSION_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS "AttendanceSession" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "date" TIMESTAMP NOT NULL UNIQUE,
    "isClosed" BOOLEAN NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMP NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`

function normalizeSessionRow(row: {
  id: string
  date: Date | string
  isClosed: boolean
  closedAt: Date | string | null
  createdAt: Date | string
}): AttendanceSessionRecord {
  return {
    id: row.id,
    date: row.date instanceof Date ? row.date.toISOString() : row.date,
    isClosed: row.isClosed,
    closedAt: row.closedAt instanceof Date ? row.closedAt.toISOString() : row.closedAt,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  }
}

/**
 * Returns the current day's start timestamp.
 * The AttendanceSession model stores one session per calendar day.
 */
export function getTodaySessionDate(): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

export function getTodaySessionDateIso(): string {
  return getTodaySessionDate().toISOString()
}

export async function getTodaySession(): Promise<AttendanceSessionRecord | null> {
  await prisma.$executeRawUnsafe(SESSION_TABLE_SQL)

  const [session] = await prisma.$queryRaw<AttendanceSessionRecord[]>`
    SELECT
      "id",
      "date",
      "isClosed",
      "closedAt",
      "createdAt"
    FROM "AttendanceSession"
    WHERE "date" = ${getTodaySessionDate()}
    LIMIT 1
  `

  return session ? normalizeSessionRow(session) : null
}

/**
 * Ensures a daily attendance session exists for the current day.
 * Safe to call multiple times because the date column is unique.
 */
export async function ensureTodaySessionExists() {
  await prisma.$executeRawUnsafe(SESSION_TABLE_SQL)

  const date = getTodaySessionDate()
  const existing = await getTodaySession()
  if (existing) return existing

  const id = crypto.randomUUID()

  await prisma.$executeRaw`
    INSERT INTO "AttendanceSession" ("id", "date", "isClosed", "createdAt")
    VALUES (${id}, ${date}, ${false}, ${new Date()})
    ON CONFLICT("date") DO NOTHING
  `

  return (await getTodaySession()) ?? {
    id,
    date: date.toISOString(),
    isClosed: false,
    closedAt: null,
    createdAt: new Date().toISOString(),
  }
}

export async function closeTodaySession(): Promise<AttendanceSessionRecord> {
  await ensureTodaySessionExists()
  const date = getTodaySessionDate()

  await prisma.$executeRaw`
    UPDATE "AttendanceSession"
    SET "isClosed" = ${true}, "closedAt" = ${new Date()}
    WHERE "date" = ${date}
  `

  const session = await getTodaySession()
  if (!session) {
    throw new Error('Unable to close today\'s attendance session')
  }

  return session
}

export async function reopenTodaySession(): Promise<AttendanceSessionRecord> {
  await ensureTodaySessionExists()
  const date = getTodaySessionDate()

  await prisma.$executeRaw`
    UPDATE "AttendanceSession"
    SET "isClosed" = ${false}, "closedAt" = ${null}
    WHERE "date" = ${date}
  `

  const session = await getTodaySession()
  if (!session) {
    throw new Error('Unable to reopen today\'s attendance session')
  }

  return session
}
