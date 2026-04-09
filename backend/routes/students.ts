import { Router, type Request, type Response } from 'express'
import { createStudent, getStudents } from '../services/studentService'

const router = Router()

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, fingerprintId, parentPhone } = req.body as {
      name?: string
      fingerprintId?: string
      parentPhone?: string
    }

    if (!name || !fingerprintId || !parentPhone) {
      return res.status(400).json({
        success: false,
        error: 'Name, fingerprintId, and parentPhone are required',
      })
    }

    const student = await createStudent({ name, fingerprintId, parentPhone })

    return res.status(201).json({
      success: true,
      message: 'Student registered successfully',
      data: student,
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return res.status(409).json({
        success: false,
        error: 'Fingerprint ID already exists',
      })
    }

    console.error('POST /students/register error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to register student',
    })
  }
})

router.get('/', async (_req: Request, res: Response) => {
  try {
    const students = await getStudents()
    return res.json({
      success: true,
      data: students,
    })
  } catch (error) {
    console.error('GET /students error:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch students',
    })
  }
})

export default router
