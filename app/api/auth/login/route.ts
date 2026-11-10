import { NextRequest, NextResponse } from 'next/server'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionValue,
  isCorrectLogin,
} from '@/lib/dashboardAuth'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)

  if (!isCorrectLogin(body?.email, body?.password)) {
    return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 })
  }

  const res = NextResponse.json({ success: true })
  res.cookies.set(SESSION_COOKIE, createSessionValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
  return res
}
