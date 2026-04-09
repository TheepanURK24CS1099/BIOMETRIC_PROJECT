// src/app/page.tsx
import { redirect } from 'next/navigation'
import { getServerAuth } from '@/lib/auth'

export default async function RootPage() {
  const auth = await getServerAuth()
  if (auth) redirect('/admin/dashboard')
  redirect('/attendance')
}
