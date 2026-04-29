import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import studentsRouter from './routes/students'
import prisma from './db'
import { validateEnvironment } from './config/envCheck'

dotenv.config()
validateEnvironment()

const app = express()
const PORT = Number(process.env.PORT)
const CORS_ORIGIN = process.env.CORS_ORIGIN as string

app.use(cors({ origin: CORS_ORIGIN, credentials: true }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Server is running' })
})

app.use('/students', studentsRouter)

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' })
})

async function main() {
  try {
    await prisma.$connect()
    console.log('Database connection successful')
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    })
  } catch (error) {
    console.error('Database connection failed:', error)
    process.exit(1)
  }
}

void main()
