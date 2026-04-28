const { Router } = require('express')
const { randomUUID } = require('crypto')
const prisma = require('../db')
const deviceAuth = require('../middleware/deviceAuth')
const {
  readDeviceSettings,
  saveDeviceSettings,
  checkDeviceStatus,
  connectDevice,
  disconnectDevice,
  getUsersFromDevice,
  getAttendanceLogs,
} = require('../services/deviceService')

const router = Router()

function normalizeStatus(status) {
  const value = String(status || 'PRESENT').toUpperCase()
  return ['PRESENT', 'ABSENT', 'LATE'].includes(value) ? value : 'PRESENT'
}

async function findStudentByFingerprint(fpId) {
  if (!fpId) return null

  const rows = await prisma.$queryRaw`
    SELECT "id", "name", "fp_id", "fingerprintId", "device_user_id"
    FROM "Student"
    WHERE "fp_id" = ${fpId} OR "fingerprintId" = ${fpId}
    LIMIT 1
  `

  return rows?.[0] || null
}

async function syncUsersFromDevice() {
  const device = await checkDeviceStatus()
  if (!device.connected) {
    return { success: false, error: 'Device is not connected' }
  }

  const result = await getUsersFromDevice()
  if (!result.success) {
    return { success: false, error: result.error || 'Failed to read device users' }
  }

  const synced = []
  const skipped = []

  for (const user of result.data || []) {
    const student = await findStudentByFingerprint(user.fp_id)
    if (!student) {
      skipped.push({ fp_id: user.fp_id, device_user_id: user.device_user_id, reason: 'No matching student' })
      continue
    }

    await prisma.$executeRaw`
      UPDATE "Student"
      SET "fp_id" = ${user.fp_id},
          "device_user_id" = ${user.device_user_id}
      WHERE "id" = ${student.id}
    `

    synced.push({
      studentId: student.id,
      name: student.name,
      fp_id: user.fp_id,
      device_user_id: user.device_user_id,
    })
  }

  return {
    success: true,
    message: `Synced ${synced.length} user(s) from device`,
    data: { synced, skipped },
  }
}

async function syncAttendanceFromDevice(io, options = {}) {
  const device = await checkDeviceStatus()
  if (!device.connected) {
    return { success: false, error: 'Device is not connected' }
  }

  const result = await getAttendanceLogs()
  if (!result.success) {
    return { success: false, error: result.error || 'Failed to read attendance logs' }
  }

  const inserted = []
  const skipped = []

  for (const log of result.data || []) {
    const student = await findStudentByFingerprint(log.fp_id)
    if (!student) {
      skipped.push({ device_log_id: log.device_log_id, fp_id: log.fp_id, reason: 'No matching student' })
      continue
    }

    const duplicateByLog = await prisma.$queryRaw`
      SELECT "id"
      FROM "Attendance"
      WHERE "device_log_id" = ${log.device_log_id}
      LIMIT 1
    `

    if (duplicateByLog?.length) {
      skipped.push({ device_log_id: log.device_log_id, fp_id: log.fp_id, reason: 'Duplicate device log' })
      continue
    }

    const existing = await prisma.$queryRaw`
      SELECT "id"
      FROM "Attendance"
      WHERE ("device_log_id" = ${log.device_log_id} AND "device_id" = ${log.device_id})
         OR ("studentId" = ${student.id} AND "date" = ${log.date || new Date().toISOString().slice(0, 10)})
      LIMIT 1
    `

    if (existing?.length) {
      skipped.push({ device_log_id: log.device_log_id, fp_id: log.fp_id, reason: 'Attendance already exists' })
      continue
    }

    const attendanceStatus = normalizeStatus(log.status)
    const date = log.date || new Date().toISOString().slice(0, 10)
    const time = log.time || new Date().toTimeString().slice(0, 8)
    const attendanceId = randomUUID()

    await prisma.$executeRaw`
      INSERT INTO "Attendance" (
        "id",
        "studentName",
        "studentId",
        "date",
        "status",
        "time",
        "notes",
        "device_log_id",
        "device_id",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${attendanceId},
        ${student.name},
        ${student.id},
        ${date},
        ${attendanceStatus},
        ${time},
        ${options.source === 'auto' ? 'Auto-synced from biometric device' : 'Synced from biometric device'},
        ${log.device_log_id},
        ${log.device_id},
        ${new Date()},
        ${new Date()}
      )
    `

    const attendanceData = {
      id: attendanceId,
      studentName: student.name,
      studentId: student.id,
      date,
      status: attendanceStatus,
      time,
      device_log_id: log.device_log_id,
      device_id: log.device_id,
    }

    inserted.push(attendanceData)

    if (io) {
      io.emit('attendance-update', attendanceData)
    }
  }

  return {
    success: true,
    message: `Synced ${inserted.length} attendance record(s)`,
    data: { inserted, skipped },
  }
}

router.get('/api/device', async (_req, res) => {
  try {
    const settings = await readDeviceSettings()
    const status = await checkDeviceStatus()
    return res.json({ success: true, data: { ...settings, ...status.data } })
  } catch (error) {
    console.error('GET /api/device error:', error)
    return res.status(500).json({ success: false, error: 'Failed to load device settings' })
  }
})

router.post('/api/device/save', deviceAuth, async (req, res) => {
  try {
    const { device_name, device_ip, device_port } = req.body || {}
    const settings = await saveDeviceSettings({ device_name, device_ip, device_port })

    const deviceMode = String(process.env.DEVICE_MODE || 'mock').toLowerCase()
    if (deviceMode !== 'mock') {
      if (settings.device_ip) {
        await connectDevice(settings.device_ip, settings.device_port)
      } else {
        await disconnectDevice()
      }
    }

    const status = await checkDeviceStatus()
    return res.json({ success: true, message: 'Device settings saved', data: { ...settings, ...status.data } })
  } catch (error) {
    console.error('POST /api/device/save error:', error)
    return res.status(500).json({ success: false, error: 'Failed to save device settings' })
  }
})

router.post('/api/device/sync-users', deviceAuth, async (_req, res) => {
  try {
    const result = await syncUsersFromDevice()
    return res.status(result.success ? 200 : 400).json(result)
  } catch (error) {
    console.error('POST /api/device/sync-users error:', error)
    return res.status(500).json({ success: false, error: 'Failed to sync users' })
  }
})

router.post('/api/device/sync-attendance', deviceAuth, async (req, res) => {
  try {
    const result = await syncAttendanceFromDevice(req.app.get('io'), { source: 'manual' })
    return res.status(result.success ? 200 : 400).json(result)
  } catch (error) {
    console.error('POST /api/device/sync-attendance error:', error)
    return res.status(500).json({ success: false, error: 'Failed to sync attendance' })
  }
})

module.exports = {
  router,
  syncAttendanceFromDevice,
  syncUsersFromDevice,
}