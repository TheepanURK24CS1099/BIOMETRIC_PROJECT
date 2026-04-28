import { useEffect, useState } from 'react'

type Student = {
  id: string
  name: string
  fingerprintId: string
  parentPhone: string
  createdAt: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL

if (!API_URL) {
  throw new Error('Missing required environment variable: NEXT_PUBLIC_API_URL')
}

export default function RegisterStudent() {
  const [form, setForm] = useState({ name: '', fingerprintId: '', parentPhone: '' })
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  async function loadStudents() {
    setLoading(true)
    try {
      const response = await fetch(`${API_URL}/students`)
      const data = await response.json()
      if (data.success) {
        setStudents(data.data)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadStudents()
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)

    try {
      const response = await fetch(`${API_URL}/students/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        alert(data.error || 'Failed to register student')
        return
      }

      alert('Student registered successfully')
      setForm({ name: '', fingerprintId: '', parentPhone: '' })
      await loadStudents()
    } catch {
      alert('Connection error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', padding: '32px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <header style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Student Hostel Attendance</h1>
          <p style={{ color: '#94a3b8' }}>Register students and save data directly to PostgreSQL.</p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          <section style={{ background: '#111827', padding: '24px', borderRadius: '16px', border: '1px solid #1f2937' }}>
            <h2 style={{ marginBottom: '16px' }}>Register Student</h2>
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
              <input
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                style={inputStyle}
                required
              />
              <input
                placeholder="Fingerprint will auto assign after first scan"
                value={form.fingerprintId}
                onChange={(e) => setForm((prev) => ({ ...prev, fingerprintId: e.target.value.toUpperCase() }))}
                style={inputStyle}
                required
              />
              <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '-6px' }}>
                Fingerprint will auto assign after first scan.
              </div>
              <input
                placeholder="Parent Phone"
                value={form.parentPhone}
                onChange={(e) => setForm((prev) => ({ ...prev, parentPhone: e.target.value }))}
                style={inputStyle}
                required
              />
              <button
                type="submit"
                disabled={saving}
                style={buttonStyle}
              >
                {saving ? 'Saving...' : 'Register Student'}
              </button>
            </form>
          </section>

          <section style={{ background: '#111827', padding: '24px', borderRadius: '16px', border: '1px solid #1f2937' }}>
            <h2 style={{ marginBottom: '16px' }}>Registered Students</h2>
            {loading ? (
              <p>Loading...</p>
            ) : students.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No students registered yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {students.map((student) => (
                  <div key={student.id} style={cardStyle}>
                    <div><strong>Name:</strong> {student.name}</div>
                    <div><strong>Device User ID:</strong> {student.fingerprintId}</div>
                    <div><strong>Parent Phone:</strong> {student.parentPhone}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: '10px',
  border: '1px solid #334155',
  background: '#0f172a',
  color: '#e2e8f0',
}

const buttonStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: '10px',
  border: 'none',
  background: 'linear-gradient(90deg, #7c3aed, #ef4444)',
  color: 'white',
  fontWeight: 700,
  cursor: 'pointer',
}

const cardStyle: React.CSSProperties = {
  padding: '14px',
  borderRadius: '12px',
  background: '#0f172a',
  border: '1px solid #334155',
  display: 'grid',
  gap: '6px',
}
