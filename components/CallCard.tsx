'use client'

import { useState, useEffect } from 'react'
import { Phone, MessageSquare, PhoneCall, VoicemailIcon, User, Building2, PhoneOutgoing, Info } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import type { Call } from '@/lib/supabase'

interface Props {
  call: Call
  transcript: string
  onDecision: (decision: 'pickup' | 'voicemail') => void
  deciding: boolean
}

export function CallCard({ call, transcript, onDecision, deciding }: Props) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = new Date(call.started_at).getTime()
    const tick = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(tick)
  }, [call.started_at])

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const isActive = ['ringing', 'screening', 'holding'].includes(call.status)

  return (
    <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center">
            <User className="w-6 h-6 text-indigo-300" />
          </div>
          <div>
            <p className="font-semibold text-lg leading-tight">
              {call.display_name ?? call.caller_name ?? 'Unknown Caller'}
            </p>
            <p className="text-sm text-zinc-400">{call.from_number}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={call.status} />
          <span className="text-xs text-zinc-500 tabular-nums">{fmt(elapsed)}</span>
        </div>
      </div>

      {/* Channel + Line badges */}
      <div className="flex gap-2">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-zinc-700 text-zinc-300">
          {call.channel === 'whatsapp'
            ? <><MessageSquare className="w-3 h-3" /> WhatsApp</>
            : <><Phone className="w-3 h-3" /> Phone</>}
        </span>
        {call.line && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-zinc-700 text-zinc-300 capitalize">
            {call.line}
          </span>
        )}
      </div>

      {/* Collected info (only when holding) */}
      {call.status === 'holding' && (call.caller_name || call.caller_company || call.caller_reason) && (
        <div className="rounded-xl bg-zinc-900/60 border border-zinc-700/50 p-4 flex flex-col gap-2 text-sm">
          {call.caller_name && (
            <div className="flex items-center gap-2 text-zinc-300">
              <User className="w-4 h-4 text-zinc-500 shrink-0" />
              <span>{call.caller_name}</span>
            </div>
          )}
          {call.caller_company && (
            <div className="flex items-center gap-2 text-zinc-300">
              <Building2 className="w-4 h-4 text-zinc-500 shrink-0" />
              <span>{call.caller_company}</span>
            </div>
          )}
          {call.caller_reason && (
            <div className="flex items-center gap-2 text-zinc-300">
              <Info className="w-4 h-4 text-zinc-500 shrink-0" />
              <span>{call.caller_reason}</span>
            </div>
          )}
        </div>
      )}

      {/* Live transcript ticker */}
      {transcript && (
        <div className="rounded-xl bg-zinc-900/40 border border-zinc-800 px-3 py-2 text-xs text-zinc-400 italic line-clamp-2">
          &ldquo;{transcript}&rdquo;
        </div>
      )}

      {/* Decision buttons */}
      {isActive && (
        <div className="flex gap-3 mt-1">
          <button
            onClick={() => onDecision('pickup')}
            disabled={deciding}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-3 transition-colors"
          >
            <PhoneCall className="w-4 h-4" />
            Pick Up
          </button>
          <button
            onClick={() => onDecision('voicemail')}
            disabled={deciding}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-semibold py-3 transition-colors"
          >
            <VoicemailIcon className="w-4 h-4" />
            Voicemail
          </button>
        </div>
      )}
    </div>
  )
}
