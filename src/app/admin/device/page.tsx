'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { io, Socket } from 'socket.io-client'

type DeviceSettings = {
  device_name: string
  device_ip: string
  device_port: number
  device_status: string
}

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL

if (!BACKEND_URL) {
  throw new Error('Missing required environment variable: NEXT_PUBLIC_API_URL')
}

const DEVICE_API_KEY = process.env.NEXT_PUBLIC_DEVICE_API_KEY || ''

export default function DevicePage() {
  const [settings, setSettings] = useState<DeviceSettings>({
    device_name: 'Realtime C101+',
    device_ip: '',
    device_port: 4370,
    device_status: 'OFFLINE',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncingUsers, setSyncingUsers] = useState(false)
  const [syncingAttendance, setSyncingAttendance] = useState(false)

  async function loadSettings() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/device`)
      const data = await res.json()

      if (data.success) {
        setSettings(data.data)
      } else {
        toast.error(data.error || 'Failed to load device settings')
      }
    } catch {
      toast.error('Failed to load device settings')
    } finally {
      setLoading(false)
    }
  }

  async function saveSettings() {
    setSaving(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/device/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-key': DEVICE_API_KEY,
        },
        body: JSON.stringify(settings),
      })
      const data = await res.json()

      if (data.success) {
        toast.success(data.message || 'Device settings saved')
        setSettings(data.data)
      } else {
        toast.error(data.error || 'Failed to save device settings')
      }
    } catch {
      toast.error('Failed to save device settings')
    } finally {
      setSaving(false)
    }
  }

  async function syncUsers() {
    setSyncingUsers(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/device/sync-users`, {
        method: 'POST',
        headers: { 'x-device-key': DEVICE_API_KEY },
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message || 'Users synced')
      } else {
        toast.error(data.error || 'Failed to sync users')
      }
    } catch {
      toast.error('Failed to sync users')
    } finally {
      setSyncingUsers(false)
    }
  }

  async function syncAttendance() {
    setSyncingAttendance(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/device/sync-attendance`, {
        method: 'POST',
        headers: { 'x-device-key': DEVICE_API_KEY },
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message || 'Attendance synced')
      } else {
        toast.error(data.error || 'Failed to sync attendance')
      }
    } catch {
      toast.error('Failed to sync attendance')
    } finally {
      setSyncingAttendance(false)
    }
  }

  useEffect(() => {
    void loadSettings()
  }, [])

  useEffect(() => {
    const socket: Socket = io(BACKEND_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
    })

    socket.on('device-status-update', (status) => {
      setSettings((prev) => ({
        ...prev,
        device_status: status?.device_status || prev.device_status,
      }))
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  if (loading) {
    return <div className="h-64 flex items-center justify-center text-white">Loading device settings...</div>
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl font-800 text-white">Device Settings</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Enroll fingerprint on biometric device.
        </p>
      </div>

      <div className="card p-6 space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Device Name</label>
          <input
            value={settings.device_name}
            onChange={(e) => setSettings({ ...settings, device_name: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-black/20 border"
            style={{ borderColor: 'var(--border)', color: 'white' }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Device IP</label>
            <input
              value={settings.device_ip}
              onChange={(e) => setSettings({ ...settings, device_ip: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-black/20 border"
              style={{ borderColor: 'var(--border)', color: 'white' }}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Device Port</label>
            <input
              type="number"
              value={settings.device_port}
              onChange={(e) => setSettings({ ...settings, device_port: Number(e.target.value || 4370) })}
              className="w-full px-4 py-3 rounded-xl bg-black/20 border"
              style={{ borderColor: 'var(--border)', color: 'white' }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap pt-2">
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Status: <span className="font-semibold text-white">{settings.device_status}</span>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(196,77,239,0.16)', color: '#d8b4fe', border: '1px solid rgba(196,77,239,0.3)' }}
            >
              {saving ? 'Saving...' : 'Save Device'}
            </button>
            <button
              onClick={syncUsers}
              disabled={syncingUsers}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(16,185,129,0.16)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }}
            >
              {syncingUsers ? 'Syncing...' : 'Sync Users'}
            </button>
            <button
              onClick={syncAttendance}
              disabled={syncingAttendance}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(59,130,246,0.16)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)' }}
            >
              {syncingAttendance ? 'Syncing...' : 'Sync Attendance'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}