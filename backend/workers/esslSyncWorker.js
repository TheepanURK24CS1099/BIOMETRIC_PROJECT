require('dotenv').config()

const axios = require('axios')

const logger = console
const ESSL_SYNC_ENABLED = String(process.env.ESSL_SYNC_ENABLED || 'false').toLowerCase() === 'true'
const ESSL_API_URL = process.env.ESSL_API_URL || ''
const ESSL_USERNAME = process.env.ESSL_USERNAME || ''
const ESSL_PASSWORD = process.env.ESSL_PASSWORD || ''
const ESSL_DEVICE_SERIAL = process.env.ESSL_DEVICE_SERIAL || ''
const ESSL_SYNC_INTERVAL_MS = Number(process.env.ESSL_SYNC_INTERVAL_MS || 5000)
const ESSL_SCAN_API_URL = process.env.ESSL_SCAN_API_URL || 'http://127.0.0.1:3000/api/attendance/scan'
const DUPLICATE_WINDOW_MS = 10000
const MAX_RETRIES = 3

let syncRunning = false
const lastPunchByEmployeeCode = new Map()

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeValue(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function getEmployeeCode(log) {
  if (!log || typeof log !== 'object') return ''

  return normalizeValue(
    log.EmployeeCode ||
      log.UserID ||
      log.employeeCode ||
      log.userID ||
      log.userId ||
      log.fingerprintId ||
      ''
  )
}

async function sendAttendanceScan(fingerprintId) {
  let lastError = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      await axios.post(ESSL_SCAN_API_URL, { fingerprintId }, { timeout: 10000 })
      console.log(`[ESSL] Attendance API success: ${fingerprintId}`)
      return { success: true }
    } catch (error) {
      lastError = error

      if (attempt < MAX_RETRIES) {
        await sleep(500 * attempt)
      }
    }
  }

  console.error(
    `[ESSL] Attendance API failed: ${fingerprintId}`,
    lastError instanceof Error ? lastError.message : lastError
  )

  return {
    success: false,
    error: lastError instanceof Error ? lastError.message : 'Unknown error',
  }
}

async function processPunchLog(log) {
  const employeeCode = getEmployeeCode(log)

  if (!employeeCode) {
    return { success: false, ignored: true, reason: 'missing_employee_code' }
  }

  const now = Date.now()
  const lastSeenAt = lastPunchByEmployeeCode.get(employeeCode)

  if (lastSeenAt && now - lastSeenAt < DUPLICATE_WINDOW_MS) {
    console.log(`[ESSL] Duplicate ignored: ${employeeCode}`)
    return { success: true, ignored: true, duplicate: true }
  }

  lastPunchByEmployeeCode.set(employeeCode, now)
  console.log(`[ESSL] Punch received: ${employeeCode}`)

  const result = await sendAttendanceScan(employeeCode)

  if (!result.success) {
    return { success: false, employeeCode, error: result.error }
  }

  return { success: true, employeeCode }
}

async function fetchTransactionsLog() {
  // TODO: Call eSSL GetTransactionsLog SOAP API and normalize the response here.
  // The worker is prepared for future punch log ingestion.
  return []
}

async function syncOnce() {
  if (syncRunning) return
  syncRunning = true

  try {
    const logs = await fetchTransactionsLog()

    for (const log of logs) {
      await processPunchLog(log)
    }
  } catch (error) {
    console.error('[ESSL] Worker error:', error instanceof Error ? error.message : error)
  } finally {
    syncRunning = false
  }
}

async function bootstrap() {
  console.log('[ESSL] Worker started')

  if (!ESSL_SYNC_ENABLED) {
    console.log('[ESSL] Worker disabled')
    process.exit(0)
    return
  }

  void syncOnce()

  setInterval(() => {
    void syncOnce()
  }, ESSL_SYNC_INTERVAL_MS)

  if (ESSL_API_URL || ESSL_USERNAME || ESSL_PASSWORD || ESSL_DEVICE_SERIAL) {
    logger.info('[ESSL] Device configuration loaded')
  }
}

process.on('SIGINT', () => {
  process.exit(0)
})

process.on('SIGTERM', () => {
  process.exit(0)
})

process.on('unhandledRejection', (error) => {
  logger.error('[ESSL] unhandledRejection:', error instanceof Error ? error.message : error)
})

process.on('uncaughtException', (error) => {
  logger.error('[ESSL] uncaughtException:', error instanceof Error ? error.message : error)
})

if (require.main === module) {
  void bootstrap().catch((error) => {
    console.error('[ESSL] Bootstrap failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
}

module.exports = {
  processPunchLog,
  fetchTransactionsLog,
  sendAttendanceScan,
}