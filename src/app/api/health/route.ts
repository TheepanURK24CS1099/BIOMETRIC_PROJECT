import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    server: 'running',
    timestamp: new Date().toISOString(),
  })
}