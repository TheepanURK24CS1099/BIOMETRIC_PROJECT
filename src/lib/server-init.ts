// src/lib/server-init.ts
import { ensureTodaySessionExists } from '@/lib/createDailySession'

// Initialize today's attendance session as soon as the server loads this module.
void ensureTodaySessionExists().catch((error) => {
  console.error('Failed to initialize today\'s attendance session:', error)
})
