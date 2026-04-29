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

function normalizeFingerprintId(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : ''
}

function extractFingerprintId(source = {}) {
  return normalizeFingerprintId(
    source.userId || source.fingerprintId || source.uid || source.fp_id || source.device_user_id
  )
}

async function findStudentByFingerprint(fpId) {
  const fingerprintId = normalizeFingerprintId(fpId)
  if (!fingerprintId) return null

  return prisma.student.findFirst({
    where: {
      OR: [
        { fingerprintId },
        { fp_id: fingerprintId },
        { device_user_id: fingerprintId },
      ],
    },
  })
}

async function createPlaceholderStudent(fingerprintId, deviceName) {
  const normalizedFingerprintId = normalizeFingerprintId(fingerprintId)

  if (!normalizedFingerprintId) {
    return null
  }

  const existing = await findStudentByFingerprint(normalizedFingerprintId)
  if (existing) {
    console.log(`Existing student found for fingerprintId: ${normalizedFingerprintId}`)
    return existing
  }

  try {
    const student = await prisma.student.create({
      data: {
        name: deviceName || `Unknown Student ${normalizedFingerprintId}`,
        roomNumber: 'UNKNOWN',
        parentPhone: 'UNKNOWN',
        fingerprintId: normalizedFingerprintId,
        fp_id: normalizedFingerprintId,
        device_user_id: normalizedFingerprintId,
        isActive: true,
      },
    })

    console.log(`Auto-created student from device: ${normalizedFingerprintId}`)
    return student
  } catch (error) {
    if (error?.code === 'P2002') {
      const student = await findStudentByFingerprint(normalizedFingerprintId)
      if (student) {
        console.log(`Existing student found for fingerprintId: ${normalizedFingerprintId}`)
        return student
      }
    }

    throw error
  }
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
    const fingerprintId = extractFingerprintId(user)
    if (!fingerprintId) {
      console.error('Device sync skipped: missing fingerprintId')
      skipped.push({ reason: 'Missing fingerprintId' })
      continue
    }

    let student = await findStudentByFingerprint(fingerprintId)
    if (student) {
      console.log(`Existing student found for fingerprintId: ${fingerprintId}`)
    } else {
      student = await createPlaceholderStudent(fingerprintId, user.name)
    }

    const shouldUseDeviceName = Boolean(user.name) && (!student.name || String(student.name).startsWith('Unknown Student'))
    const resolvedName = shouldUseDeviceName ? user.name : student.name

    await prisma.student.update({
      where: { id: student.id },
      data: {
        fingerprintId,
        fp_id: fingerprintId,
        device_user_id: fingerprintId,
        ...(resolvedName ? { name: resolvedName } : {}),
        isActive: true,
      },
    })

    synced.push({
      studentId: student.id,
      name: resolvedName,
      fingerprintId,
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
    const fingerprintId = extractFingerprintId(log)
    if (!fingerprintId) {
      console.error('Device sync skipped: missing fingerprintId')
      skipped.push({ device_log_id: log.device_log_id, reason: 'Missing fingerprintId' })
      continue
    }

    let student = await findStudentByFingerprint(fingerprintId)
    if (student) {
      console.log(`Existing student found for fingerprintId: ${fingerprintId}`)
    } else {
      student = await createPlaceholderStudent(fingerprintId, log.name)
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

    console.log(`Marked attendance for fingerprintId: ${fingerprintId}`)

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

    const deviceMode = String(process.env.DEVICE_MODE || 'disabled').toLowerCase()
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