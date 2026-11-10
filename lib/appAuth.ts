import { createHash, timingSafeEqual } from 'crypto'
import { NextRequest } from 'next/server'

const digest = (value: string) => createHash('sha256').update(value).digest()

// Protects the private iOS app's routes. Fails closed if APP_API_TOKEN isn't configured.
export function isAppAuthorized(req: NextRequest): boolean {
  const expected = process.env.APP_API_TOKEN
  if (!expected) return false
  const header = req.headers.get('authorization') ?? ''
  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
  return timingSafeEqual(digest(provided), digest(expected))
}
