// src/types/index.ts

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE'

export interface Student {
  id: string
  name: string
  roomNumber: string
  parentPhone: string
  fingerprintId: string
  photoUrl?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Attendance {
  id: string
  studentId: string
  student?: Student
  date: string
  status: AttendanceStatus
  time?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface Admin {
  id: string
  username: string
  name: string
  createdAt: string
}

export interface DashboardStats {
  totalStudents: number
  presentToday: number
  absentToday: number
  lateToday: number
  attendanceRate: number
}

export interface AttendanceRecord {
  student: Student
  attendance: Attendance | null
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface StudentFormData {
  name: string
  roomNumber: string
  parentPhone: string
  fingerprintId: string
  photoUrl?: string
}

export interface AttendanceExport {
  date: string
  studentName: string
  roomNumber: string
  status: AttendanceStatus
  time: string | null
}
