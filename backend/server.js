require('dotenv').config()

const http = require('http')
const express = require('express')
const cors = require('cors')
const { Server } = require('socket.io')
const { validateEnvironment } = require('./config/envCheck')
const prisma = require('./db')
const whatsappRouter = require('./routes/whatsapp')
const { router: deviceRouter } = require('./routes/device')
const { readDeviceStatus } = require('./services/deviceService')

validateEnvironment()

const app = express()
const PORT = Number(process.env.PORT)
const CORS_ORIGIN = process.env.CORS_ORIGIN
const SOCKET_ENABLED = String(process.env.SOCKET_ENABLED || 'true').toLowerCase() !== 'false'
const server = http.createServer(app)
const io = SOCKET_ENABLED
  ? new Server(server, {
      cors: { origin: CORS_ORIGIN, credentials: true },
    })
  : {
      emit: () => {},
      on: () => {},
    }

app.use(cors({ origin: CORS_ORIGIN, credentials: true }))
app.use(express.json())
app.set('io', io)

console.log('Backend environment loaded:', {
  port: PORT,
  corsOrigin: CORS_ORIGIN,
  smsProvider: process.env.SMS_PROVIDER || 'not-set',
  whatsappProvider: process.env.WHATSAPP_PROVIDER || 'not-set',
  hasFast2SmsKey: Boolean(process.env.FAST2SMS_API_KEY),
  whatsappPhoneNumberId: process.env.FAST2SMS_WHATSAPP_PHONE_NUMBER_ID ? 'set' : 'missing',
  whatsappTemplate: process.env.FAST2SMS_WHATSAPP_TEMPLATE || 'sr_hostel_attendance',
})

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Server is running' })
})

if (SOCKET_ENABLED && io?.on) {
  io.on('connection', (socket) => {
    socket.on('device-status-update', (status) => {
      io.emit('device-status-update', status)
    })

    socket.on('attendance-update', (attendanceData) => {
      io.emit('attendance-update', attendanceData)
    })
  })
}

app.use('/', whatsappRouter)
app.use('/', deviceRouter)

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' })
})

async function start() {
  try {
    await prisma.$connect()
    await readDeviceStatus().catch((error) => {
      console.error('Failed to load device status:', error)
    })
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    })
  } catch (error) {
    console.error('Server startup failed:', error)
    process.exit(1)
  }
}

void start()
