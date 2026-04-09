const axios = require('axios')

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '').replace(/^91/, '')
}

function getTemplateName() {
  return process.env.FAST2SMS_WHATSAPP_TEMPLATE || 'sr_hostel_attendance'
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0]
}

async function sendAttendanceWhatsApp(name, status, phone) {
  const smsProvider = process.env.SMS_PROVIDER || 'mock'
  const whatsappProvider = process.env.WHATSAPP_PROVIDER || 'mock'
  const apiKey = process.env.FAST2SMS_API_KEY
  const phoneNumberId = process.env.FAST2SMS_WHATSAPP_PHONE_NUMBER_ID
  const templateName = getTemplateName()

  console.log('WhatsApp config:', {
    smsProvider,
    whatsappProvider,
    templateName,
    phoneNumberId: phoneNumberId ? 'set' : 'missing',
  })

  if (whatsappProvider !== 'fast2sms') {
    console.log('⚠ WhatsApp provider disabled')
    return false
  }

  if (!apiKey || !phoneNumberId) {
    console.error('Missing FAST2SMS_API_KEY or FAST2SMS_WHATSAPP_PHONE_NUMBER_ID')
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
        accept: 'application/json',
      },
      timeout: 15000,
    })

    console.log('Fast2SMS WhatsApp response:', response.data)
    console.log(`✅ WhatsApp sent to +91${normalizePhone(phone)}`)
    return true
  } catch (error) {
    if (error.response) {
      console.error('Fast2SMS WhatsApp failed:', error.response.data || error.response.statusText)
    } else {
      console.error('Fast2SMS WhatsApp request failed:', error.message || error)
    }
    return false
  }
}

module.exports = {
  sendAttendanceWhatsApp,
}
