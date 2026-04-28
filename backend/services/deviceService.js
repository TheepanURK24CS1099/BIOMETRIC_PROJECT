const fs = require('fs/promises')
const path = require('path')

const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'device-settings.json')
const STATUS_FILE = path.join(__dirname, '..', 'data', 'device-status.json')
const DEVICE_MODE = String(process.env.DEVICE_MODE || 'mock').toLowerCase()
const DEFAULT_DEVICE_PORT = Number(process.env.DEVICE_PORT || 4370)

const DEFAULT_SETTINGS = {
  device_name: 'Realtime C101+',
  device_ip: '',
  device_port: DEFAULT_DEVICE_PORT,
  device_status: 'OFFLINE',
}

let activeConnection = null

async function ensureActiveConnection(settings) {
  if (DEVICE_MODE === 'mock') {
    return true
  }

  if (activeConnection) {
    return true
  }

  if (!settings?.device_ip) {
    return false
  }

  const result = await connectDevice(settings.device_ip, settings.device_port)
  return Boolean(result?.connected)
}

async function ensureSettingsFile() {
  try {
    await fs.access(SETTINGS_FILE)
  } catch {
    await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true })
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf8')
  }
}

async function ensureStatusFile() {
  try {
    await fs.access(STATUS_FILE)
  } catch {
    await fs.mkdir(path.dirname(STATUS_FILE), { recursive: true })
    await fs.writeFile(
      STATUS_FILE,
      JSON.stringify(
        {
          device_status: 'OFFLINE',
          connected: false,
          mode: DEVICE_MODE,
          last_checked_at: null,
        },
        null,
        2
      ),
      'utf8'
    )
  }
}

async function readDeviceSettings() {
  await ensureSettingsFile()

  try {
    const content = await fs.readFile(SETTINGS_FILE, 'utf8')
    return { ...DEFAULT_SETTINGS, ...JSON.parse(content) }
  } catch (error) {
    console.error('Failed to read device settings:', error)
    return { ...DEFAULT_SETTINGS }
  }
}

async function readDeviceStatus() {
  await ensureStatusFile()

  try {
    const content = await fs.readFile(STATUS_FILE, 'utf8')
    return JSON.parse(content)
  } catch (error) {
    console.error('Failed to read device status:', error)
    return {
      device_status: 'OFFLINE',
      connected: false,
      mode: DEVICE_MODE,
      last_checked_at: null,
    }
  }
}

async function writeDeviceStatus(status) {
  await ensureStatusFile()
  await fs.writeFile(STATUS_FILE, JSON.stringify(status, null, 2), 'utf8')
  return status
}

async function saveDeviceSettings(input) {
  const current = await readDeviceSettings()
  const next = {
    ...current,
    ...input,
    device_port: Number(input.device_port || current.device_port || DEFAULT_DEVICE_PORT),
    device_status: current.device_status || 'OFFLINE',
  }

  await fs.writeFile(SETTINGS_FILE, JSON.stringify(next, null, 2), 'utf8')
  return next
}

async function connectDevice(ip, port = DEFAULT_DEVICE_PORT) {
  if (!ip) {
    return { success: false, connected: false, error: 'Device IP is required' }
  }

  activeConnection = { ip, port: Number(port || DEFAULT_DEVICE_PORT), connectedAt: new Date().toISOString() }

  await writeDeviceStatus({
    device_status: 'ONLINE',
    connected: true,
    mode: DEVICE_MODE,
    ip: activeConnection.ip,
    port: activeConnection.port,
    last_checked_at: new Date().toISOString(),
    connected_at: activeConnection.connectedAt,
  })

  return {
    success: true,
    connected: true,
    data: {
      ip: activeConnection.ip,
      port: activeConnection.port,
      connectedAt: activeConnection.connectedAt,
    },
  }
}

async function disconnectDevice() {
  activeConnection = null
  await writeDeviceStatus({
    device_status: 'OFFLINE',
    connected: false,
    mode: DEVICE_MODE,
    last_checked_at: new Date().toISOString(),
  })
  return { success: true, connected: false }
}

async function checkDeviceStatus() {
  const settings = await readDeviceSettings()
  const connected = await ensureActiveConnection(settings)
  const status = {
    ...settings,
    device_status: connected ? 'ONLINE' : 'OFFLINE',
    connected,
    mode: DEVICE_MODE,
    last_checked_at: new Date().toISOString(),
  }

  await writeDeviceStatus(status)

  return {
    success: true,
    connected,
    data: status,
  }
}

async function getUsersFromDevice() {
  if (DEVICE_MODE === 'mock') {
    await checkDeviceStatus()
    return {
      success: true,
      data: [
        { fp_id: 'FP008', device_user_id: '1008', name: 'Sample Student 1' },
        { fp_id: 'FP009', device_user_id: '1009', name: 'Sample Student 2' },
      ],
    }
  }

  const status = await checkDeviceStatus()
  if (!status.connected) {
    return { success: false, error: 'Device not connected', data: [] }
  }

  return {
    success: true,
    data: [],
  }
}

async function getAttendanceLogs() {
  if (DEVICE_MODE === 'mock') {
    await checkDeviceStatus()
    const today = new Date().toISOString().slice(0, 10)

    return {
      success: true,
      data: [
        {
          device_log_id: `log-${today}-FP008-1`,
          device_id: 'c101-plus',
          fp_id: 'FP008',
          date: today,
          time: '09:00:00',
          status: 'PRESENT',
        },
        {
          device_log_id: `log-${today}-FP009-1`,
          device_id: 'c101-plus',
          fp_id: 'FP009',
          date: today,
          time: '09:05:00',
          status: 'PRESENT',
        },
      ],
    }
  }

  const status = await checkDeviceStatus()
  if (!status.connected) {
    return { success: false, error: 'Device not connected', data: [] }
  }

  return {
    success: true,
    data: [],
  }
}

module.exports = {
  DEFAULT_SETTINGS,
  connectDevice,
  disconnectDevice,
  getUsersFromDevice,
  getAttendanceLogs,
  checkDeviceStatus,
  readDeviceStatus,
  readDeviceSettings,
  saveDeviceSettings,
}