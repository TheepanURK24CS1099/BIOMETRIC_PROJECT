// src/lib/utils.ts
import { format, parseISO } from 'date-fns'

export function getTodayDate(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function getCurrentTime(): string {
  return format(new Date(), 'HH:mm:ss')
}

export function formatDate(date: string): string {
  try {
    return format(parseISO(date), 'dd MMM yyyy')
  } catch {
    return date
  }
}

export function formatTime(time: string | null | undefined): string {
  if (!time) return '—'
  try {
    const [h, m] = time.split(':')
    const hour = parseInt(h)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${m} ${ampm}`
  } catch {
    return time
  }
}

export function formatClockTime(time: string | null | undefined): string {
  if (!time) return '—'
  const normalized = time.length === 5 ? `${time}:00` : time
  return formatTime(normalized)
}

export function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function isLate(time: string): boolean {
  const cutoff = process.env.ATTENDANCE_CUTOFF_TIME || '22:00'
  return time > cutoff
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function phoneValidate(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone.replace(/\D/g, ''))
}

export function generateExportCSV(data: Record<string, unknown>[]): string {
  if (!data.length) return ''
  const headers = Object.keys(data[0])
  const rows = data.map((row) =>
    headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')
  )
  return [headers.join(','), ...rows].join('\n')
}

export function paginate<T>(items: T[], page: number, limit: number) {
  const total = items.length
  const totalPages = Math.ceil(total / limit)
  const start = (page - 1) * limit
  const data = items.slice(start, start + limit)
  return { data, total, page, limit, totalPages }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'PRESENT': return 'text-emerald-400 bg-emerald-400/10'
    case 'OUT MARKED':
    case 'IN MARKED': return 'text-cyan-400 bg-cyan-400/10'
    case 'MORNING OUT NOT MARKED': return 'text-amber-400 bg-amber-400/10'
    case 'NOT RETURNED':
    case 'ABSENT': return 'text-red-400 bg-red-400/10'
    case 'NO ATTENDANCE': return 'text-rose-400 bg-rose-400/10'
    case 'LATE': return 'text-amber-400 bg-amber-400/10'
    default: return 'text-slate-400 bg-slate-400/10'
  }
}

export function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'PRESENT': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    case 'OUT MARKED':
    case 'IN MARKED': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
    case 'MORNING OUT NOT MARKED': return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    case 'NOT RETURNED':
    case 'ABSENT': return 'bg-red-500/20 text-red-300 border-red-500/30'
    case 'NO ATTENDANCE': return 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    case 'LATE': return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30'
  }
}
