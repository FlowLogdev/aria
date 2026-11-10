'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Phone, MessageSquare, Play } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import type { Call } from '@/lib/supabase'

function fmt(seconds: number | null): string {
  if (!seconds) return '—'
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function RecordingPlayer({ callId }: { callId: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/calls/${callId}/recording`)
      const body = await res.json().catch(() => null)
      if (res.ok && body?.url) setUrl(body.url)
      else setError(res.status === 404 ? 'No recording for this call.' : 'Could not load the recording. Try again.')
    } catch {
      setError('Could not load the recording. Try again.')
    }
    setLoading(false)
  }

  if (url) {
    return <audio controls autoPlay src={url} onError={() => { setUrl(null); setError('The recording could not be played. Try again.') }} className="w-full max-w-md" />
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={load}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
      >
        <Play className="w-3.5 h-3.5" />
        {loading ? 'Loading…' : 'Play recording'}
      </button>
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

function CallRow({ call }: { call: Call }) {
  const [expanded, setExpanded] = useState(false)
  const summary = call.summary ? (() => {
    try { return JSON.parse(call.summary!) } catch { return null }
  })() : null

  return (
    <>
      <tr
        className="border-b border-zinc-800/50 hover:bg-zinc-900/40 cursor-pointer transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
          <div>{fmtDate(call.started_at)}</div>
          <div className="text-zinc-600">{fmtTime(call.started_at)}</div>
        </td>
        <td className="px-4 py-3">
          <div className="font-medium text-sm">{call.display_name ?? call.caller_name ?? <span className="text-zinc-500">Unknown</span>}</div>
          <div className="text-xs text-zinc-500">{call.from_number}</div>
        </td>
        <td className="px-4 py-3 text-center">
          {call.channel === 'whatsapp'
            ? <MessageSquare className="w-4 h-4 text-green-400 mx-auto" />
            : <Phone className="w-4 h-4 text-zinc-400 mx-auto" />}
        </td>
        <td className="px-4 py-3 text-xs text-zinc-400 capitalize">{call.line ?? '—'}</td>
        <td className="px-4 py-3"><StatusBadge status={call.status} /></td>
        <td className="px-4 py-3 text-xs text-zinc-400 tabular-nums">{fmt(call.duration_seconds)}</td>
        <td className="px-4 py-3 text-zinc-600">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-zinc-800/50 bg-zinc-900/20">
          <td colSpan={7} className="px-4 py-4">
            <div className="flex flex-col gap-3">
              {(call.vapi_call_id || call.recording_url) && <RecordingPlayer callId={call.id} />}
              {summary && (
                <div className="rounded-lg border border-indigo-500/20 bg-indigo-950/20 p-3 text-sm">
                  <p className="text-indigo-300 font-medium mb-1">{summary.intent}</p>
                  <p className="text-zinc-400 text-xs whitespace-pre-line">{summary.keyInfo}</p>
                  {summary.suggestedAction && (
                    <p className="text-zinc-500 text-xs mt-1 italic">→ {summary.suggestedAction}</p>
                  )}
                </div>
              )}
              {call.transcript && (
                <div>
                  <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Transcript</p>
                  <p className="text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed">{call.transcript}</p>
                </div>
              )}
              {!call.transcript && !summary && (
                <p className="text-xs text-zinc-600 italic">No transcript available.</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export function CallLog({ calls }: { calls: Call[] }) {
  if (calls.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-zinc-600 text-sm">
        No calls yet.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase tracking-wide">
            <th className="px-4 py-2 text-left">Time</th>
            <th className="px-4 py-2 text-left">Caller</th>
            <th className="px-4 py-2 text-center">Ch</th>
            <th className="px-4 py-2 text-left">Line</th>
            <th className="px-4 py-2 text-left">Status</th>
            <th className="px-4 py-2 text-left">Duration</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {calls.map(call => <CallRow key={call.id} call={call} />)}
        </tbody>
      </table>
    </div>
  )
}
