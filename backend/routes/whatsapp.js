const { Router } = require('express')
const { sendAttendanceWhatsApp } = require('../services/whatsappService')

const router = Router()

router.post('/send-whatsapp', async (req, res) => {
  try {
    const { phone, name, status } = req.body || {}

    if (!phone || !name || !status) {
      return res.status(400).json({
        success: false,
        error: 'phone, name, and status are required',
      })
    }

    console.log('POST /send-whatsapp body:', { phone, name, status })

    const success = await sendAttendanceWhatsApp(name, status, phone)

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
