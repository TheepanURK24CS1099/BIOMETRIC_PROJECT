function deviceAuth(req, res, next) {
  const providedKey = req.get('x-device-key')
  const expectedKey = process.env.DEVICE_API_KEY

  if (!expectedKey || !providedKey || providedKey !== expectedKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized device request',
    })
  }

  return next()
}

module.exports = deviceAuth
