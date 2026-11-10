'use client'

import { useState, type FormEvent } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (res.ok) {
        window.location.assign('/')
        return
      }
      setError('Incorrect email or password.')
    } catch {
      setError('Could not reach the server. Try again.')
    }
    setSubmitting(false)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-white">Aria</h1>
        <label className="block text-sm text-gray-300">
          Email
          <input
            type="email"
            autoComplete="username"
            autoFocus
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-white"
          />
        </label>
        <label className="block text-sm text-gray-300">
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-white"
          />
        </label>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-white px-3 py-2 font-medium text-gray-950 disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
