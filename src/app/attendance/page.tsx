'use client'
// src/app/attendance/page.tsx
import { useState, useRef, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import toast from 'react-hot-toast'
import { formatTime, getStatusBadgeColor } from '@/lib/utils'
import type { Student, Attendance } from '@/types'

type ScanState = 'idle' | 'scanning' | 'success' | 'already' | 'error'

interface ScanResult {
  student?: Student
  attendance?: Attendance
  message: string
  error?: string
}

export default function AttendanceScanPage() {
  const [fingerprintId, setFingerprintId] = useState('')
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [currentTime, setCurrentTime] = useState('')
  const [liveScanStatus, setLiveScanStatus] = useState('🟢 Place your finger on the device')
  const [deviceStatus, setDeviceStatus] = useState<'ONLINE' | 'OFFLINE'>('OFFLINE')
  const inputRef = useRef<HTMLInputElement>(null)
  const resetTimer = useRef<NodeJS.Timeout>()

  // Live clock
  useEffect(() => {
    function tick() {
      const now = new Date()
      setCurrentTime(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus()
  }, [scanState])

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL

    if (!backendUrl) {
      throw new Error('Missing required environment variable: NEXT_PUBLIC_API_URL')
    }

    const socket: Socket = io(backendUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
    })

    socket.on('attendance-update', () => {
      setLiveScanStatus('✅ Attendance Marked — Present')
      setTimeout(() => setLiveScanStatus('🟢 Place your finger on the device'), 5000)
    })

    socket.on('disconnect', () => {
      setDeviceStatus('OFFLINE')
    })

    socket.on('device-status-update', (status) => {
      if (!status || status.device_status !== 'ONLINE') {
        setDeviceStatus('OFFLINE')
        return
      }

      setDeviceStatus('ONLINE')
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  // Auto-reset after success/error
  function scheduleReset(delay = 5000) {
    clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => {
      setScanState('idle')
      setResult(null)
      setFingerprintId('')
      inputRef.current?.focus()
    }, delay)
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault()
    if (deviceStatus !== 'ONLINE') {
      toast.error('Device is offline')
      return
    }
    if (!fingerprintId.trim()) return

    setScanState('scanning')

    try {
      const res = await fetch('/api/attendance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprintId: fingerprintId.trim() }),
      })
      const data = await res.json()

      if (res.status === 409) {
        // Already marked
        setScanState('already')
        setResult({ student: data.data?.student, attendance: data.data?.attendance, message: data.error })
        scheduleReset(6000)
      } else if (data.success) {
        setScanState('success')
        setResult({ student: data.data.student, attendance: data.data.attendance, message: data.message })
        toast.success(`✅ Attendance marked for ${data.data.student?.name || 'student'}`)
        toast.success('📩 Notification sent')
        if (String(data.message || '').toLowerCase().includes('whatsapp') && String(data.message || '').toLowerCase().includes('sms')) {
          toast('⚠ WhatsApp failed → SMS sent', { icon: '⚠' })
        }
        scheduleReset(5000)
      } else {
        setScanState('error')
        setResult({ message: data.error || 'Scan failed' })
        scheduleReset(4000)
      }
    } catch (error) {
      console.error('API Error:', error)
      setScanState('error')
      setResult({ message: 'Connection error. Please try again.' })
      scheduleReset(4000)
    }
  }

  function handleReset() {
    clearTimeout(resetTimer.current)
    setScanState('idle')
    setResult(null)
    setFingerprintId('')
    inputRef.current?.focus()
  }

  const stateConfig = {
    idle: {
      icon: '⬡',
      iconColor: '#c44def',
      iconBg: 'rgba(196,77,239,0.15)',
      glowColor: 'rgba(196,77,239,0.3)',
      title: 'Ready for Fingerprint Scan',
      subtitle: 'Place your finger on the device',
    },
    scanning: {
      icon: '◈',
      iconColor: '#f59e0b',
      iconBg: 'rgba(245,158,11,0.15)',
      glowColor: 'rgba(245,158,11,0.3)',
      title: 'Scanning...',
      subtitle: 'Please wait',
    },
    success: {
      icon: '✓',
      iconColor: '#10b981',
      iconBg: 'rgba(16,185,129,0.15)',
      glowColor: 'rgba(16,185,129,0.3)',
      title: 'Attendance Marked!',
      subtitle: 'SMS sent to parent',
    },
    already: {
      icon: '◷',
      iconColor: '#f59e0b',
      iconBg: 'rgba(245,158,11,0.15)',
      glowColor: 'rgba(245,158,11,0.3)',
      title: 'Already Marked',
      subtitle: 'Attendance recorded earlier today',
    },
    error: {
      icon: '✕',
      iconColor: '#ef4444',
      iconBg: 'rgba(239,68,68,0.15)',
      glowColor: 'rgba(239,68,68,0.3)',
      title: 'Scan Failed',
      subtitle: 'Fingerprint not recognized',
    },
  }

  const cfg = stateConfig[scanState]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-3xl opacity-10 transition-all duration-1000"
          style={{ background: `radial-gradient(circle, ${cfg.glowColor}, transparent)` }} />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full blur-3xl opacity-5"
          style={{ background: 'radial-gradient(circle, #e11d48, transparent)' }} />
      </div>

      {/* Header bar */}
      <header className="relative z-10 px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)', background: 'rgba(6,11,24,0.8)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #c44def, #a92fd2)' }}>
            ⬡
          </div>
          <div>
            <div className="font-display font-700 text-sm text-white">Girls Hostel</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Attendance System</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-xl font-700 text-white tabular-nums">{currentTime}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
      </header>

      {/* Main scan area */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md">

          {/* State icon */}
          <div className="flex justify-center mb-8">
            <div
              className="relative w-32 h-32 rounded-3xl flex items-center justify-center transition-all duration-500"
              style={{
                background: cfg.iconBg,
                border: `2px solid ${cfg.iconColor}40`,
                boxShadow: `0 0 60px ${cfg.glowColor}`,
              }}
            >
              {/* Scan animation bars */}
              {scanState === 'idle' && (
                <div className="absolute inset-0 rounded-3xl overflow-hidden">
                  <div className="scan-line" />
                </div>
              )}
              {scanState === 'scanning' && (
                <div className="absolute inset-0 rounded-3xl overflow-hidden">
                  <div className="scan-line" style={{ animationDuration: '1s' }} />
                </div>
              )}

              {/* Fingerprint icon */}
              <svg
                viewBox="0 0 64 64"
                className={`w-16 h-16 transition-all duration-500 ${scanState === 'idle' ? 'fingerprint-pulse' : ''}`}
                style={{ color: cfg.iconColor, opacity: scanState === 'scanning' ? 0.6 : 1 }}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                {scanState === 'success' ? (
                  <path d="M16 32 L28 44 L48 22" strokeWidth="3" />
                ) : scanState === 'error' ? (
                  <>
                    <path d="M20 20 L44 44" strokeWidth="3" />
                    <path d="M44 20 L20 44" strokeWidth="3" />
                  </>
                ) : (
                  <>
                    <path d="M32 8 C20 8 12 17 12 28" />
                    <path d="M32 8 C44 8 52 17 52 28" />
                    <path d="M20 28 C20 22 25 18 32 18 C39 18 44 22 44 28" />
                    <path d="M26 32 C26 29 28.7 27 32 27 C35.3 27 38 29 38 32 C38 38 32 44 32 44" />
                    <path d="M20 34 C20 40 25 48 32 50" />
                    <path d="M44 34 C44 40 39 48 32 50" />
                    <path d="M14 22 C13 24 12 26 12 28" />
                    <path d="M50 22 C51 24 52 26 52 28" />
                  </>
                )}
              </svg>

              {scanState === 'scanning' && (
                <div className="absolute inset-0 rounded-3xl border-2 border-amber-400/30 animate-ping" />
              )}
            </div>
          </div>

          {/* State text */}
          <div className="text-center mb-8 transition-all duration-500">
            <h1 className="font-display text-3xl font-800 text-white mb-2" style={{ color: cfg.iconColor }}>
              {cfg.title}
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>{cfg.subtitle}</p>
          </div>

          <div className="mb-6 text-center text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {liveScanStatus}
          </div>

          {/* Device Status Badge */}
          <div className="mb-6 text-center">
            {deviceStatus === 'ONLINE' ? (
              <span
                className="inline-block px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
              >
                🟢 Device Status: ONLINE
              </span>
            ) : (
              <span
                className="inline-block px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: 'rgba(107,114,128,0.15)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.3)' }}
              >
                🔴 Device Status: OFFLINE
              </span>
            )}
          </div>

          {/* Result card */}
          {result?.student && (
            <div className="card p-5 mb-6 animate-slide-up"
              style={{ borderColor: `${cfg.iconColor}30`, background: cfg.iconBg }}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #c44def, #a92fd2)' }}>
                  {result.student.name.startsWith('Unknown') ? '?' : result.student.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-xl font-700 text-white">
                    {result.student.name.startsWith('Unknown') ? `Unknown (${result.student.fingerprintId})` : result.student.name}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Room {result.student.roomNumber}
                  </p>
                  {result.attendance && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`badge ${getStatusBadgeColor(result.attendance.status)}`}>
                        {result.attendance.status}
                      </span>
                      {(result.attendance.outTime || result.attendance.time) && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          at {formatTime(result.attendance.outTime || result.attendance.time)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {scanState === 'error' && result && (
            <div className="p-4 rounded-xl mb-6 text-center text-sm"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
              {result.message}
            </div>
          )}

          {/* Input form */}
          {(scanState === 'idle' || scanState === 'error') && (
            <form onSubmit={handleScan} className="space-y-4 animate-fade-in">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  className="input-base text-center text-2xl font-display font-700 h-16 tracking-widest uppercase"
                  placeholder="FP001"
                  value={fingerprintId}
                  onChange={e => setFingerprintId(e.target.value.toUpperCase())}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  disabled={deviceStatus !== 'ONLINE'}
                  style={{ fontSize: '1.5rem', letterSpacing: '0.15em' }}
                />
                <p className="mt-2 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                  {deviceStatus === 'ONLINE' ? 'Scan fingerprint to mark attendance' : 'Device offline'}
                </p>
              </div>
              <button
                type="submit"
                disabled={deviceStatus !== 'ONLINE'}
                className="btn-primary w-full h-16 text-xl font-display font-700"
                style={{ fontSize: '1.125rem' }}
              >
                {deviceStatus === 'ONLINE' ? '⬡ Biometric Device Ready' : '⬡ Device Offline'}
              </button>
            </form>
          )}

          {/* Auto-reset countdown / manual reset */}
          {(scanState === 'success' || scanState === 'already') && (
            <div className="text-center animate-fade-in">
              <button
                onClick={handleReset}
                className="px-8 py-3 rounded-xl font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
              >
                ↩ Scan Next Student
              </button>
              <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                Auto-resets in 5 seconds
              </p>
            </div>
          )}

          {/* Admin link */}
          <div className="text-center mt-10">
            <a href="/admin/login" className="text-xs transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#c44def')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
              Admin Panel →
            </a>
          </div>
        </div>
      </main>

    </div>
  )
}
