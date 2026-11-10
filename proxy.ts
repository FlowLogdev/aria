import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, isValidSession } from '@/lib/dashboardAuth'

// These authenticate themselves: webhooks by provider signature/secret, mobile routes by bearer token.
const SELF_AUTHENTICATED_PREFIXES = ['/api/webhook/', '/api/mobile/']
const PUBLIC_PATHS = new Set(['/login', '/api/auth/login'])

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.has(pathname) || SELF_AUTHENTICATED_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  if (isValidSession(req.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.redirect(new URL('/login', req.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico$).*)'],
}
