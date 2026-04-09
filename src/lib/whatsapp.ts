const DEFAULT_WHATSAPP_SERVICE_URL = 'http://localhost:3001/send-whatsapp'

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^91/, '')
}

export async function sendAttendanceWhatsApp(name: string, status: string, phone: string): Promise<boolean> {
  const provider = process.env.WHATSAPP_PROVIDER || 'fast2sms'
  const serviceUrl = process.env.WHATSAPP_SERVICE_URL || DEFAULT_WHATSAPP_SERVICE_URL

  if (provider !== 'fast2sms') {
    console.log('⚠ WhatsApp provider disabled, skipping WhatsApp send')
    return false
  }

  try {
    const response = await fetch(serviceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: normalizePhone(phone),
        name,
        status,
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
