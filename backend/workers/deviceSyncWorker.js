require('dotenv').config()

const { io: createClient } = require('socket.io-client')
const { checkDeviceStatus } = require('../services/deviceService')
const { syncAttendanceFromDevice, syncUsersFromDevice } = require('../routes/device')
const { validateEnvironment } = require('../config/envCheck')

validateEnvironment()

const PORT = Number(process.env.PORT || 3001)
const SOCKET_ENABLED = String(process.env.SOCKET_ENABLED || 'true').toLowerCase() !== 'false'
const SOCKET_SERVER_URL = process.env.SOCKET_SERVER_URL || `http://127.0.0.1:${PORT}`
const DEVICE_SYNC_INTERVAL = Number(process.env.DEVICE_SYNC_INTERVAL || 5000)
const HEARTBEAT_INTERVAL = 10000
const USER_SYNC_INTERVAL = 30000
const logger = console

let socket = null
let syncRunning = false
let heartbeatRunning = false
let lastDeviceStatus = null
let lastSyncMessage = null

function emitToServer(event, payload) {
  if (socket && socket.connected) {
    socket.emit(event, payload)
  }
}

async function runHeartbeat() {
  if (heartbeatRunning) return
  heartbeatRunning = true

  try {
    const status = await checkDeviceStatus()
    if (status.data.device_status !== lastDeviceStatus) {
      lastDeviceStatus = status.data.device_status
      console.log(`[device-heartbeat] ${status.data.device_status}`)
    }
    emitToServer('device-status-update', status.data)
  } catch (error) {
    console.error('[device-heartbeat] failed:', error instanceof Error ? error.message : error)
    emitToServer('device-status-update', {
      device_status: 'OFFLINE',
      connected: false,
      mode: process.env.DEVICE_MODE || 'mock',
      last_checked_at: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  } finally {
    heartbeatRunning = false
  }
}

async function runSync() {
  if (syncRunning) return
  syncRunning = true

  try {
    const result = await syncAttendanceFromDevice({ emit: emitToServer }, { source: 'worker' })
    if (!result.success) {
      console.error('[device-sync] failed:', result.error)
    } else if (result.message !== lastSyncMessage) {
      lastSyncMessage = result.message
      console.log(`[device-sync] ${result.message}`)
    }
  } catch (error) {
    console.error('[device-sync] exception:', error instanceof Error ? error.message : error)
  } finally {
    syncRunning = false
  }
}

async function syncAttendanceLogs() {
  return runSync()
}

async function autoSyncUsers() {
  try {
    const result = await syncUsersFromDevice()

    if (result?.success) {
      emitToServer('device-user-sync')
      if (result.message) {
        logger.info(`[device-user-sync] ${result.message}`)
      }
      return
    }

    logger.error('[device-user-sync] failed:', result?.error || 'Unknown error')
  } catch (err) {
    logger.error('[device-user-sync] failed:', err?.message || err)
  }
}

function startLoops() {
  void runHeartbeat()
  void runSync()

  setInterval(() => {
    void runHeartbeat()
  }, HEARTBEAT_INTERVAL)

  setInterval(() => {
    void syncAttendanceLogs().catch((err) => {
      logger.error('Attendance sync failed:', err?.message || err)
    })
  }, DEVICE_SYNC_INTERVAL)

  setInterval(() => {
    void autoSyncUsers()
  }, USER_SYNC_INTERVAL)
}

async function bootstrap() {
  if (SOCKET_ENABLED) {
    socket = createClient(SOCKET_SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    })

    socket.on('connect', () => {
      console.log(`[device-worker] connected to ${SOCKET_SERVER_URL}`)
    })

    socket.on('disconnect', (reason) => {
      console.log('[device-worker] disconnected:', reason)
    })

    socket.on('connect_error', (error) => {
      console.error('[device-worker] connect error:', error.message || error)
    })

    socket.on('reconnect', (attempt) => {
      console.log(`[device-worker] reconnected after ${attempt} attempt(s)`)
    })
  } else {
    console.log('[device-worker] socket disabled')
  }

  startLoops()
}

process.on('SIGINT', () => {
  if (socket) socket.close()
  process.exit(0)
})

process.on('SIGTERM', () => {
  if (socket) socket.close()
  process.exit(0)
})

process.on('unhandledRejection', (error) => {
  logger.error('[device-worker] unhandledRejection:', error instanceof Error ? error.message : error)
})

process.on('uncaughtException', (error) => {
  logger.error('[device-worker] uncaughtException:', error instanceof Error ? error.message : error)
})

void bootstrap().catch((error) => {
  console.error('[device-worker] bootstrap failed:', error)
  process.exit(1)
})