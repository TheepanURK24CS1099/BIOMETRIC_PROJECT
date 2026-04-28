// src/lib/auth.ts
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const jwtSecret = process.env.JWT_SECRET

if (!jwtSecret || !jwtSecret.trim()) {
  throw new Error('Missing required environment variable: JWT_SECRET')
}

const JWT_SECRET = new TextEncoder().encode(jwtSecret)

export interface JWTPayload {
  adminId: string
  username: string
  name: string
}

export async function signToken(payload: JWTPayload): Promise<string> {
  const expiresIn = process.env.JWT_EXPIRES_IN || '8h'
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

export async function getAuthFromRequest(req: NextRequest): Promise<JWTPayload | null> {
  const token =
    req.cookies.get('auth-token')?.value ||
    req.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) return null
  return verifyToken(token)
}

export async function getServerAuth(): Promise<JWTPayload | null> {
  const cookieStore = cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  return verifyToken(token)
}

export function isAuthenticated(auth: JWTPayload | null): boolean {
  return auth !== null
}
