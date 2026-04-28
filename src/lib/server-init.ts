// src/lib/server-init.ts
import { ensureTodaySessionExists } from '@/lib/createDailySession'

// Avoid blocking Next.js dev startup. Bootstrap sessions only in production and do it async.
if (process.env.NODE_ENV === 'production') {
  setTimeout(() => {
    void ensureTodaySessionExists().catch((error) => {
      console.error('Failed to initialize today\'s attendance session:', error)
    })
  }, 0)
}
