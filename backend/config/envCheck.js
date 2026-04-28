function requireEnv(name) {
  const value = process.env[name]
  if (!value || !String(value).trim()) {
    throw new Error(`[env-check] Missing required environment variable: ${name}`)
  }
  return value
}

function validateEnvironment() {
  requireEnv('DATABASE_URL')
  requireEnv('JWT_SECRET')
  requireEnv('DEVICE_API_KEY')
  requireEnv('PORT')
  requireEnv('CORS_ORIGIN')
}

module.exports = {
  requireEnv,
  validateEnvironment,
}
