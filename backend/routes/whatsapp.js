const { Router } = require('express')
const { sendAttendanceWhatsApp } = require('../services/whatsappService')
const deviceAuth = require('../middleware/deviceAuth')

const router = Router()

router.post('/send-whatsapp', deviceAuth, async (req, res) => {
  try {
    const { phone, parent, name, status, date, time } = req.body || {}

    if (!phone || !name || !status || !date || !time) {
      return res.status(400).json({
        success: false,
        error: 'phone, name, status, date, and time are required',
      })
    }

    console.log('POST /send-whatsapp body:', { phone, parent, name, status, date, time })

    const success = await sendAttendanceWhatsApp({ parent, name, status, date, time, phone })

    if (success) {
      return res.status(200).json({
        success: true,
        message: 'WhatsApp message sent successfully',
      })
    }

    return res.status(502).json({
      success: false,
      error: 'WhatsApp message failed',
    })
  } catch (error) {
    console.error('POST /send-whatsapp error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
})

module.exports = router
