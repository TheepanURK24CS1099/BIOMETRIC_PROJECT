'use client'
// src/app/admin/attendance/page.tsx
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getTodayDate, formatDate, formatTime, getStatusBadgeColor } from '@/lib/utils'
import type { Attendance } from '@/types'

type AttendanceWithStudent = Attendance & { student: { name: string; roomNumber: string; fingerprintId: string } }

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceWithStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(getTodayDate())
  const [statusFilter, setStatusFilter] = useState('')
  const [total, setTotal] = useState(0)
  const [exporting, setExporting] = useState(false)

  async function fetchRecords() {
    if (loading && records.length > 0) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ date, limit: '200' })
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/attendance?${params}`)
      const data = await res.json()
      if (data.success) { setRecords(data.data); setTotal(data.total) }
    } catch (error) { console.error('API Error:', error); toast.error('Failed to load attendance') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchRecords() }, [date, statusFilter])

  async function handleExport() {
    if (exporting) return
    setExporting(true)
    try {
      const res = await fetch(`/api/attendance/export?from=${date}&to=${date}&format=csv`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `attendance_${date}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Exported!')
    } catch (error) { console.error('API Error:', error); toast.error('Export failed') }
    finally { setExporting(false) }
  }

  const present = records.filter(r => r.status === 'PRESENT').length
  const absent = records.filter(r => r.status === 'ABSENT').length
  const late = records.filter(r => r.status === 'LATE').length

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-800 text-white">Attendance Records</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {formatDate(date)} · {total} records
          </p>
        </div>
        <button onClick={handleExport} disabled={exporting}
          className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
          {exporting ? 'Exporting...' : '↓ Export CSV'}
        </button>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3 flex-wrap">
        {[
          { label: 'Present', value: present, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
          { label: 'Absent', value: absent, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
          { label: 'Late', value: late, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
        ].map(p => (
          <div key={p.label} className="px-4 py-2 rounded-xl flex items-center gap-2"
            style={{ background: p.bg, border: `1px solid ${p.color}30` }}>
            <span className="text-lg font-display font-800" style={{ color: p.color }}>{p.value}</span>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{p.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="date"
          className="input-base w-auto"
          value={date}
          onChange={e => setDate(e.target.value)}
          max={getTodayDate()}
        />
        <select
          className="input-base w-auto"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="PRESENT">Present</option>
          <option value="ABSENT">Absent</option>
          <option value="LATE">Late</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-7 h-7 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center min-h-[220px]" style={{ color: 'var(--text-muted)' }}>
            <div className="text-4xl mb-3">◷</div>
            <p>No attendance data available</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Student', 'Room', 'Status', 'Time', 'Notes'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-600 tracking-wider uppercase"
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={r.id}
                    style={{ borderBottom: i < records.length - 1 ? '1px solid var(--border)' : 'none' }}
                    className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #c44def, #a92fd2)' }}>
                          {r.student.name.startsWith('Unknown') ? '?' : r.student.name.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-white">{r.student.name.startsWith('Unknown') ? `Unknown (${r.student.fingerprintId})` : r.student.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{r.student.roomNumber}</td>
                    <td className="px-5 py-4">
                      <span className={`badge ${getStatusBadgeColor(r.status)}`}>{r.status}</span>
                    </td>
                    <td className="px-5 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{formatTime(r.time)}</td>
                    <td className="px-5 py-4 text-xs" style={{ color: 'var(--text-muted)' }}>{r.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
