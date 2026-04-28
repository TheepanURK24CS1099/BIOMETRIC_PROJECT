const axios = require('axios')

function normalizePhone(phone) {
  let cleaned = String(phone || '').replace(/\D/g, '')
  
  // Ensure starts with 91
  if (!cleaned.startsWith('91')) {
    cleaned = '91' + cleaned
  }

  return cleaned
}

function getTemplateName() {
  return process.env.FAST2SMS_WHATSAPP_TEMPLATE || 'sr_hostel_attendance'
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0]
}

async function sendAttendanceWhatsApp(name, status, phone, room) {
  const whatsappProvider = process.env.WHATSAPP_PROVIDER || 'mock'
  const apiKey = process.env.FAST2SMS_API_KEY
  const phoneNumberId = process.env.FAST2SMS_WHATSAPP_PHONE_NUMBER_ID
  const templateName = getTemplateName()

  console.log('WhatsApp config:', {
    provider: whatsappProvider,
    templateName,
    phoneNumberId: phoneNumberId ? 'set' : 'missing',
  })

  if (whatsappProvider !== 'fast2sms') {
    console.log('⚠ WhatsApp disabled')
    return false
  }

  if (!apiKey || !phoneNumberId) {
    console.error('❌ Missing API KEY or PHONE NUMBER ID')
    return false
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizePhone(phone),
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: name },
            { type: 'text', text: room || '-' },
            { type: 'text', text: status },
            { type: 'text', text: getTodayDate() },
          ],
        },
      ],
    },
  }

  try {
    const url = `https://www.fast2sms.com/dev/whatsapp/v24.0/${phoneNumberId}/messages`

    const response = await axios.post(url, payload, {
      headers: {
        authorization: apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    })

    console.log('✅ WhatsApp sent:', response.data)
    return true

  } catch (error) {
    console.error('❌ WhatsApp error:',
      error.response?.data || error.message
    )
    return false
  }
}

module.exports = {
  sendAttendanceWhatsApp,
}