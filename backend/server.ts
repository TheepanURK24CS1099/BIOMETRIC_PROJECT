import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import studentsRouter from './routes/students'
import prisma from './db'

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT || 3000)
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

app.use(cors({ origin: CORS_ORIGIN }))
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
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('Server startup failed:', error)
    process.exit(1)
  }
}

void main()
