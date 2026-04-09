require('dotenv').config()

const express = require('express')
const cors = require('cors')
const prisma = require('./db')
const whatsappRouter = require('./routes/whatsapp')

const app = express()
const PORT = Number(process.env.PORT || 3001)
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000'

app.use(cors({ origin: CORS_ORIGIN, credentials: true }))
app.use(express.json())

console.log('Backend environment loaded:', {
  smsProvider: process.env.SMS_PROVIDER || 'not-set',
  whatsappProvider: process.env.WHATSAPP_PROVIDER || 'not-set',
  hasFast2SmsKey: Boolean(process.env.FAST2SMS_API_KEY),
  whatsappPhoneNumberId: process.env.FAST2SMS_WHATSAPP_PHONE_NUMBER_ID ? 'set' : 'missing',
  whatsappTemplate: process.env.FAST2SMS_WHATSAPP_TEMPLATE || 'sr_hostel_attendance',
})

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Server is running' })
})

app.use('/', whatsappRouter)

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' })
})

async function start() {
  try {
    await prisma.$connect()
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('Server startup failed:', error)
    process.exit(1)
  }
}

void start()
