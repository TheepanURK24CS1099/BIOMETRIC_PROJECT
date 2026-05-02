function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^91/, '')
}

type SendWhatsAppParams = {
  phone: string
  message: string
}

export type AttendanceWhatsAppPayload = {
  phone: string
  parentName: string
  studentName: string
  status: string
  date: string
  time: string
}

export async function sendWhatsApp({ phone, message }: SendWhatsAppParams): Promise<boolean> {
  const provider = process.env.WHATSAPP_PROVIDER || 'fast2sms'
  const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL
  const DEVICE_API_KEY = process.env.DEVICE_API_KEY

  if (!WHATSAPP_SERVICE_URL || !DEVICE_API_KEY) {
    console.log('⚠ WhatsApp configuration missing, skipping WhatsApp send')
    return false
  }

  if (provider !== 'fast2sms') {
    console.log('⚠ WhatsApp provider disabled, skipping WhatsApp send')
    return false
  }

  try {
    const response = await fetch(WHATSAPP_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-key': DEVICE_API_KEY,
      },
      body: JSON.stringify({
        phone: normalizePhone(phone),
        message,
      }),
    })

    const result = (await response.json().catch(() => ({}))) as {
      success?: boolean
      message?: string
      error?: string
    }

    if (!response.ok || result.success !== true) {
      console.error('POST /send-whatsapp failed:', result.message || result.error || response.statusText)
      return false
    }

    console.log(`✅ WhatsApp sent to +91${normalizePhone(phone)}`)
    return true
  } catch (error) {
    console.error('POST /send-whatsapp request failed:', error)
    return false
  }
}

export async function sendAttendanceWhatsApp(payload: AttendanceWhatsAppPayload): Promise<boolean> {
  const provider = process.env.WHATSAPP_PROVIDER || 'fast2sms'
  const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL
  const DEVICE_API_KEY = process.env.DEVICE_API_KEY

  if (!WHATSAPP_SERVICE_URL || !DEVICE_API_KEY) {
    console.log('⚠ WhatsApp configuration missing, skipping WhatsApp send')
    return false
  }

  if (provider !== 'fast2sms') {
    console.log('⚠ WhatsApp provider disabled, skipping WhatsApp send')
    return false
  }

  try {
    const response = await fetch(WHATSAPP_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-key': DEVICE_API_KEY,
      },
      body: JSON.stringify({
        phone: normalizePhone(payload.phone),
        parent: payload.parentName,
        name: payload.studentName,
        status: payload.status,
        date: payload.date,
        time: payload.time,
      }),
    })

    const result = (await response.json().catch(() => ({}))) as {
      success?: boolean
      message?: string
      error?: string
    }

    if (!response.ok || result.success !== true) {
      console.error('POST /send-whatsapp failed:', result.message || result.error || response.statusText)
      return false
    }

    console.log(`✅ WhatsApp sent to +91${normalizePhone(payload.phone)}`)
    return true
  } catch (error) {
    console.error('POST /send-whatsapp request failed:', error)
    return false
  }
}
