'use client'
// src/app/admin/dashboard/page.tsx
import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatDate, formatTime, getStatusBadgeColor } from '@/lib/utils'

interface Stats {
  totalStudents: number
  presentToday: number
  absentToday: number
  lateToday: number
  attendanceRate: number
  todaySession: { isClosed: boolean; closedAt: string | null } | null
  recentAttendance: Array<{
    id: string
    status: string
    time: string | null
    student: { name: string; roomNumber: string }
  }>
  weeklyTrend: Array<{ date: string; present: number; absent: number; late: number }>
  date: string
}

interface DashboardStudent {
  id: string
  name: string
  roomNumber: string
  parentPhone: string
  fingerprintId: string
  createdAt: string
}

interface StudentFormState {
  name: string
  roomNumber: string
  parentPhone: string
  fingerprintId: string
}

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div className="card p-6 card-hover">
      <p className="text-xs font-medium tracking-widest uppercase mb-3" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="font-display text-4xl font-800" style={{ color }}>{value}</p>
      {sub && <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [students, setStudents] = useState<DashboardStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [studentsLoading, setStudentsLoading] = useState(true)
  const [runningAbsent, setRunningAbsent] = useState(false)
  const [closingAttendance, setClosingAttendance] = useState(false)
  const [resettingAttendance, setResettingAttendance] = useState(false)
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null)
  const [showStudentModal, setShowStudentModal] = useState(false)
  const [savingStudent, setSavingStudent] = useState(false)
  const [studentForm, setStudentForm] = useState<StudentFormState>({
    name: '',
    roomNumber: '',
    parentPhone: '',
    fingerprintId: '',
  })

  async function fetchStats() {
    try {
      const res = await fetch('/api/attendance/stats')
      const data = await res.json()
      if (data.success) setStats(data.data)
    } catch {
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  async function loadStudents() {
    setStudentsLoading(true)
    try {
      const res = await fetch('/api/students')
      const data = await res.json()
      if (data.success) {
        setStudents(data.data)
      } else {
        toast.error(data.error || 'Failed to load students')
      }
    } catch {
      toast.error('Failed to load students')
    } finally {
      setStudentsLoading(false)
    }
  }

  async function handleDeleteStudent(student: DashboardStudent) {
    if (!confirm(`Delete ${student.name}? This will permanently remove the student and their attendance records.`)) return

    setDeletingStudentId(student.id)
    try {
      const res = await fetch(`/api/students/${student.id}`, { method: 'DELETE' })
      const data = await res.json()

      if (data.success) {
        toast.success(data.message || 'Student deleted successfully')
        await Promise.all([loadStudents(), fetchStats()])
      } else {
        toast.error(data.error || 'Failed to delete student')
      }
    } catch {
      toast.error('Failed to delete student')
    } finally {
      setDeletingStudentId(null)
    }
  }

  async function triggerAutoAbsent() {
    setRunningAbsent(true)
    try {
      const res = await fetch('/api/attendance/auto-absent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        fetchStats()
      } else toast.error(data.error)
    } catch {
      toast.error('Failed to run auto-absent')
    } finally {
      setRunningAbsent(false)
    }
  }

  async function closeTodayAttendance() {
    if (!confirm('Close today\'s attendance? No more marks will be allowed after this.')) return

    setClosingAttendance(true)
    try {
      const res = await fetch('/api/attendance/close', { method: 'POST' })
      const data = await res.json()

      if (data.success) {
        toast.success(data.message || 'Attendance closed successfully')
        fetchStats()
      } else {
        toast.error(data.error || 'Failed to close attendance')
      }
    } catch {
      toast.error('Failed to close attendance')
    } finally {
      setClosingAttendance(false)
    }
  }

  async function resetTodayAttendance() {
    if (!confirm('Reset today\'s attendance? This will clear all marks for today and reopen the session.')) return

    setResettingAttendance(true)
    try {
      const res = await fetch('/api/attendance/reset-today', { method: 'POST' })
      const data = await res.json()

      if (data.success) {
        toast.success(data.message || 'Attendance reset successfully')
        fetchStats()
      } else {
        toast.error(data.error || 'Failed to reset attendance')
      }
    } catch {
      toast.error('Failed to reset attendance')
    } finally {
      setResettingAttendance(false)
    }
  }

  async function handleSaveStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingStudent(true)

    try {
      const res = await fetch('/api/students/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentForm),
      })

      const data = await res.json()

      if (data.success) {
        toast.success('Student registered successfully')
        setStudentForm({ name: '', roomNumber: '', parentPhone: '', fingerprintId: '' })
        setShowStudentModal(false)
        await Promise.all([loadStudents(), fetchStats()])
      } else {
        toast.error(data.error || 'Failed to register student')
      }
    } catch {
      toast.error('Failed to register student')
    } finally {
      setSavingStudent(false)
    }
  }

  useEffect(() => {
    void Promise.all([fetchStats(), loadStudents()])
  }, [])

  useEffect(() => {
    document.body.style.overflow = showStudentModal ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [showStudentModal])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
    </div>
  )

  const notYetMarked = stats ? stats.totalStudents - stats.presentToday - stats.absentToday - stats.lateToday : 0

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-800 text-white">Dashboard</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {stats ? formatDate(stats.date) : 'Today'} · Live Overview
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={triggerAutoAbsent}
            disabled={runningAbsent}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            {runningAbsent ? '⟳ Running...' : '⚡ Mark Auto-Absent'}
          </button>
          <button
            onClick={closeTodayAttendance}
            disabled={closingAttendance || stats?.todaySession?.isClosed}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'rgba(239,68,68,0.14)', color: '#f87171', border: '1px solid rgba(239,68,68,0.28)' }}
          >
            {stats?.todaySession?.isClosed ? 'Attendance Closed' : closingAttendance ? 'Closing...' : 'Close Today Attendance'}
          </button>
          <button
            onClick={resetTodayAttendance}
            disabled={resettingAttendance}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}
          >
            {resettingAttendance ? 'Resetting...' : 'Reset Today'}
          </button>
          <Link href="/admin/attendance"
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: 'rgba(196,77,239,0.1)', color: '#c44def', border: '1px solid rgba(196,77,239,0.2)' }}>
            View All →
          </Link>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Students" value={stats?.totalStudents ?? 0} color="#f1f5f9" />
        <StatCard label="Present Today" value={stats?.presentToday ?? 0} sub={`+${stats?.lateToday ?? 0} late`} color="#10b981" />
        <StatCard label="Absent Today" value={stats?.absentToday ?? 0} color="#ef4444" />
        <StatCard label="Attendance Rate" value={`${stats?.attendanceRate ?? 0}%`} sub="including late" color="#c44def" />
      </div>

      {/* Students Section */}
      <div className="card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-5">
          <div>
            <h2 className="font-display text-2xl font-800 text-white">Students</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Register and manage hostel students directly from the dashboard.
            </p>
          </div>
          <button
            onClick={() => setShowStudentModal(true)}
            className="px-5 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'linear-gradient(135deg, #c44def, #a92fd2)', color: 'white', boxShadow: '0 10px 30px rgba(196,77,239,0.25)' }}
          >
            + Register Student
          </button>
        </div>

        <div className="overflow-x-auto">
          {studentsLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-7 h-7 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
              <div className="text-4xl mb-3">◉</div>
              <p>No students registered yet</p>
            </div>
          ) : (
            <table className="w-full min-w-[760px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Name', 'Room', 'Parent Phone', 'Fingerprint ID', 'Created Date', 'Actions'].map((heading) => (
                    <th
                      key={heading}
                      className="px-5 py-3.5 text-left text-xs font-600 tracking-wider uppercase"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((student, index) => (
                  <tr
                    key={student.id}
                    className="transition-colors hover:bg-white/[0.02]"
                    style={{ borderBottom: index < students.length - 1 ? '1px solid var(--border)' : 'none' }}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ background: 'linear-gradient(135deg, #c44def, #a92fd2)' }}
                        >
                          {student.name.charAt(0)}
                        </div>
                        <span className="font-medium text-white">{student.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{student.roomNumber}</td>
                    <td className="px-5 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{student.parentPhone}</td>
                    <td className="px-5 py-4 text-sm font-medium" style={{ color: '#c44def' }}>{student.fingerprintId}</td>
                    <td className="px-5 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(student.createdAt).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteStudent(student)}
                        disabled={deletingStudentId === student.id}
                        className="px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: 'rgba(239,68,68,0.14)', color: '#f87171', border: '1px solid rgba(239,68,68,0.28)' }}
                      >
                        {deletingStudentId === student.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Attendance Rate Bar */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-display font-700 text-white">Today&apos;s Attendance</h2>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>
              {(stats?.presentToday ?? 0) + (stats?.lateToday ?? 0)} / {stats?.totalStudents ?? 0} marked
            </span>
            {stats?.todaySession?.isClosed && (
              <span className="px-2 py-1 rounded-full text-xs" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                Closed
              </span>
            )}
          </div>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${stats?.attendanceRate ?? 0}%`,
              background: 'linear-gradient(90deg, #c44def, #10b981)',
            }} />
        </div>
        <div className="flex justify-between mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>0%</span>
          <span>100%</span>
        </div>

        {notYetMarked > 0 && (
          <div className="mt-4 p-3 rounded-xl text-sm" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}>
            ⚠ {notYetMarked} student(s) haven&apos;t marked attendance yet today
          </div>
        )}
      </div>

      {/* Recent Attendance */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-display font-700 text-white">Recent Activity</h2>
          <Link href="/attendance" className="text-xs" style={{ color: '#c44def' }}>Open Scan Station →</Link>
        </div>

        {!stats?.recentAttendance?.length ? (
          <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
            <div className="text-3xl mb-3">◷</div>
            <p>No attendance marked today</p>
          </div>
        ) : (
          <div className="space-y-2">
            {stats.recentAttendance.map((record) => (
              <div key={record.id}
                className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'linear-gradient(135deg, #c44def, #a92fd2)' }}>
                    {record.student.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{record.student.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Room {record.student.roomNumber}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatTime(record.time)}</span>
                  <span className={`badge ${getStatusBadgeColor(record.status)}`}>{record.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly trend */}
      <div className="card p-6">
        <h2 className="font-display font-700 text-white mb-5">Weekly Trend</h2>
        <div className="grid grid-cols-7 gap-2">
          {stats?.weeklyTrend.map((day) => {
            const total = day.present + day.absent + day.late
            const rate = total > 0 ? Math.round(((day.present + day.late) / total) * 100) : 0
            const dayLabel = new Date(day.date).toLocaleDateString('en', { weekday: 'short' })
            return (
              <div key={day.date} className="flex flex-col items-center gap-2">
                <div className="w-full rounded-lg overflow-hidden" style={{ height: '80px', background: 'rgba(255,255,255,0.04)' }}>
                  <div className="w-full rounded-lg transition-all" style={{
                    height: `${rate}%`,
                    marginTop: `${100 - rate}%`,
                    background: rate >= 80 ? '#10b981' : rate >= 50 ? '#c44def' : '#ef4444',
                    opacity: 0.7,
                  }} />
                </div>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{dayLabel}</span>
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{rate}%</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Register Student Modal */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(6,11,24,0.72)', backdropFilter: 'blur(10px)' }}>
          <div className="w-full max-w-lg rounded-3xl border border-white/10 shadow-2xl" style={{ background: 'linear-gradient(180deg, rgba(17,24,39,0.98), rgba(10,14,23,0.98))' }}>
            <div className="flex items-start justify-between p-6 border-b border-white/10">
              <div>
                <h3 className="font-display text-2xl font-800 text-white">Register Student</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Add a new student to PostgreSQL instantly.
                </p>
              </div>
              <button
                onClick={() => setShowStudentModal(false)}
                className="w-10 h-10 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'white' }}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Name</label>
                  <input
                    className="input-base"
                    placeholder="Priya Sharma"
                    value={studentForm.name}
                    onChange={(e) => setStudentForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Room Number</label>
                  <input
                    className="input-base"
                    placeholder="A-101"
                    value={studentForm.roomNumber}
                    onChange={(e) => setStudentForm((prev) => ({ ...prev, roomNumber: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Parent Phone</label>
                  <input
                    className="input-base"
                    placeholder="9876543210"
                    value={studentForm.parentPhone}
                    onChange={(e) => setStudentForm((prev) => ({ ...prev, parentPhone: e.target.value }))}
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Fingerprint ID</label>
                  <input
                    className="input-base"
                    placeholder="FP008"
                    value={studentForm.fingerprintId}
                    onChange={(e) => setStudentForm((prev) => ({ ...prev, fingerprintId: e.target.value.toUpperCase() }))}
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingStudent}
                  className="px-6 py-3 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: 'linear-gradient(135deg, #c44def, #a92fd2)', color: 'white', flex: '1 1 auto' }}
                >
                  {savingStudent ? 'Saving...' : 'Save Student'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowStudentModal(false)}
                  className="px-6 py-3 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border)', flex: '1 1 auto' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
