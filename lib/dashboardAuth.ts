import { createHash, createHmac, timingSafeEqual } from 'crypto'

export const SESSION_COOKIE = 'aria_session'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

const digest = (value: string) => createHash('sha256').update(value).digest()
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b))

const sign = (expiresAt: string, password: string) =>
  createHmac('sha256', password).update(`aria-dashboard:${expiresAt}`).digest('hex')

const normalizeEmail = (value: string) => value.trim().toLowerCase()

// Fails closed if DASHBOARD_EMAIL or DASHBOARD_PASSWORD isn't configured.
export function isCorrectLogin(email: unknown, candidate: unknown): boolean {
  const expectedEmail = process.env.DASHBOARD_EMAIL
  const password = process.env.DASHBOARD_PASSWORD
  if (!expectedEmail || !password) return false
  if (typeof email !== 'string' || typeof candidate !== 'string') return false
  const emailMatches = same(normalizeEmail(email), normalizeEmail(expectedEmail))
  const passwordMatches = same(candidate, password)
  return emailMatches && passwordMatches
}

export function createSessionValue(): string {
  const password = process.env.DASHBOARD_PASSWORD
  if (!password) throw new Error('DASHBOARD_PASSWORD is not configured')
  const expiresAt = String(Date.now() + SESSION_MAX_AGE_SECONDS * 1000)
  return `${expiresAt}.${sign(expiresAt, password)}`
}

// Sessions are signed with the password, so changing it logs everyone out.
export function isValidSession(value: string | undefined): boolean {
  const password = process.env.DASHBOARD_PASSWORD
  if (!password || !value) return false
  const [expiresAt, signature, extra] = value.split('.')
  if (!expiresAt || !signature || extra !== undefined) return false
  if (!/^\d+$/.test(expiresAt) || Number(expiresAt) <= Date.now()) return false
  return same(signature, sign(expiresAt, password))
}
