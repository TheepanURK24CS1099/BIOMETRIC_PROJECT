import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { signToken } from '@/lib/auth'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password required' },
        { status: 400 }
      )
    }

    const admin = await prisma.admin.findUnique({
      where: { username },
    })

    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    const isValid = await bcrypt.compare(password, admin.password)

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // 🔐 Create token
    const token = await signToken({
      adminId: admin.id,
      username: admin.username,
      name: admin.name,
    })

    // ✅ Response
    const response = NextResponse.json({
      success: true,
      data: {
        name: admin.name,
        username: admin.username,
      },
      message: 'Login successful',
    })

    // 🍪 FIXED COOKIE (IMPORTANT)
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: false,        // ✅ IMPORTANT for HTTP VPS
      sameSite: 'lax',      // ✅ avoids blocking
      maxAge: 60 * 60 * 8,  // 8 hours
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Login error:', error)

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
