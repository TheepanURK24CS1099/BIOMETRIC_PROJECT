import prisma from '@/lib/prisma'
import { formatDate, formatTime, getStatusBadgeColor } from '@/lib/utils'

type NotificationRow = {
  id: string
  studentName: string
  fingerprintId: string
  status: string
  time: string | null
  notificationStatus: 'Sent' | 'Failed'
}

export default async function NotificationsPage() {
  const recentAttendance = await prisma.attendance.findMany({
    include: {
      student: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 25,
  })

  const studentNames = [...new Set(recentAttendance.map((record) => record.student.name))]

  const notificationLogs = studentNames.length
    ? await prisma.notificationLog.findMany({
        where: {
          studentName: {
            in: studentNames,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 100,
      })
    : []

  const rows: NotificationRow[] = recentAttendance.map((record) => {
    const relatedLog = notificationLogs.find((log) => log.studentName === record.student.name)

    return {
      id: record.id,
      studentName: record.student.name,
      fingerprintId: record.student.fingerprintId,
      status: record.status,
      time: record.time,
      notificationStatus: relatedLog?.status === 'sent' ? 'Sent' : 'Failed',
    }
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-800 text-white">Notification Logs</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {formatDate(recentAttendance[0]?.date || new Date().toISOString().split('T')[0])} · Recent attendance notifications
        </p>
      </div>

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <div className="text-4xl mb-3">◷</div>
            <p>No notification records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Student Name', 'Fingerprint ID', 'Status', 'Time', 'Notification Status'].map((heading) => (
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
                {rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-white/[0.02]"
                    style={{ borderBottom: index < rows.length - 1 ? '1px solid var(--border)' : 'none' }}
                  >
                    <td className="px-5 py-4 text-sm font-medium text-white">{row.studentName}</td>
                    <td className="px-5 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {row.fingerprintId}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`badge ${getStatusBadgeColor(row.status)}`}>{row.status}</span>
                    </td>
                    <td className="px-5 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {formatTime(row.time)}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <span
                        className="px-3 py-1.5 rounded-full text-xs font-medium"
                        style={{
                          background: row.notificationStatus === 'Sent' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                          color: row.notificationStatus === 'Sent' ? '#10b981' : '#f87171',
                          border: row.notificationStatus === 'Sent' ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(239,68,68,0.25)',
                        }}
                      >
                        {row.notificationStatus}
                      </span>
                    </td>
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