'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Bot, Circle, Upload, UserPlus, Trash2 } from 'lucide-react'
import { getPusherClient, ARIA_CHANNEL, type PusherEvent } from '@/lib/pusher'
import { CallCard } from '@/components/CallCard'
import { CallLog } from '@/components/CallLog'
import type { Call, Contact } from '@/lib/supabase'

export default function Dashboard() {
  const [activeCall, setActiveCall] = useState<Call | null>(null)
  const [transcript, setTranscript] = useState('')
  const [calls, setCalls] = useState<Call[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [deciding, setDeciding] = useState(false)
  const [tab, setTab] = useState<'calls' | 'contacts'>('calls')
  const [newContact, setNewContact] = useState({ name: '', phone: '', notes: '' })
  const fileRef = useRef<HTMLInputElement>(null)
  const activeCallIdRef = useRef<string | null>(null)

  useEffect(() => {
    activeCallIdRef.current = activeCall?.id ?? null
  }, [activeCall?.id])

  // Load initial data
  useEffect(() => {
    fetch('/api/calls').then(r => r.json()).then(setCalls)
    fetch('/api/contacts').then(r => r.json()).then(setContacts)
  }, [])

  // Pusher real-time
  useEffect(() => {
    const pusher = getPusherClient()
    const channel = pusher.subscribe(ARIA_CHANNEL)

    channel.bind('INCOMING_KNOWN', (data: Extract<PusherEvent, { type: 'INCOMING_KNOWN' }>) => {
      setActiveCall(data.call)
      setTranscript('')
      setCalls(prev => [data.call, ...prev.filter(c => c.id !== data.call.id)])
    })

    channel.bind('INCOMING_UNKNOWN', (data: Extract<PusherEvent, { type: 'INCOMING_UNKNOWN' }>) => {
      setActiveCall(data.call)
      setTranscript('')
      setCalls(prev => [data.call, ...prev.filter(c => c.id !== data.call.id)])
    })

    channel.bind('CALL_SCREENING', (data: { callId: string }) => {
      setActiveCall(prev => prev?.id === data.callId ? { ...prev, status: 'screening' } : prev)
      setCalls(prev => prev.map(c => c.id === data.callId ? { ...c, status: 'screening' } : c))
    })

    channel.bind('TRANSCRIPT_UPDATE', (data: { callId: string; text: string }) => {
      if (activeCallIdRef.current === data.callId) setTranscript(data.text)
    })

    channel.bind('CALLER_INFO_READY', (data: Extract<PusherEvent, { type: 'CALLER_INFO_READY' }>) => {
      setActiveCall(prev => prev?.id === data.callId ? {
        ...prev, status: 'holding',
        caller_name: data.callerName, caller_company: data.callerCompany,
        caller_reason: data.callerReason, line: data.line,
      } : prev)
      setCalls(prev => prev.map(c => c.id === data.callId ? {
        ...c, status: 'holding',
        caller_name: data.callerName, caller_company: data.callerCompany,
        caller_reason: data.callerReason, line: data.line,
      } : c))
    })

    channel.bind('CALL_ENDED', (data: { callId: string; duration: number }) => {
      setActiveCall(prev => prev?.id === data.callId ? null : prev)
      setCalls(prev => prev.map(c => c.id === data.callId
        ? { ...c, status: 'ended', duration_seconds: data.duration }
        : c))
    })

    return () => {
      channel.unbind_all()
      pusher.unsubscribe(ARIA_CHANNEL)
    }
  }, [])

  const handleDecision = useCallback(async (decision: 'pickup' | 'voicemail') => {
    if (!activeCall) return
    setDeciding(true)
    try {
      await fetch('/api/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: activeCall.id, decision }),
      })
      setActiveCall(prev => prev ? { ...prev, status: decision === 'pickup' ? 'picked_up' : 'voicemail' } : null)
      setTimeout(() => setActiveCall(null), 3000)
    } finally {
      setDeciding(false)
    }
  }, [activeCall])

  async function addContact() {
    if (!newContact.name || !newContact.phone) return
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newContact),
    })
    const contact = await res.json()
    setContacts(prev => [...prev, contact])
    setNewContact({ name: '', phone: '', notes: '' })
  }

  async function deleteContact(id: string) {
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' })
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  async function importCSV(file: File) {
    const text = await file.text()
    const lines = text.trim().split('\n').slice(1)
    const batch = lines.map(line => {
      const [name, phone, notes] = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''))
      return { name, phone, notes: notes ?? '' }
    }).filter(c => c.name && c.phone)
    if (!batch.length) return
    await fetch('/api/contacts/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    })
    const fresh = await fetch('/api/contacts').then(r => r.json())
    setContacts(fresh)
  }

  return (
    <div className="min-h-screen bg-[#07070d] text-white p-4 md:p-6">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none">Aria</h1>
            <p className="text-xs text-zinc-500">RJ40 Virtual Secretary</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-green-400">
          <Circle className="w-2 h-2 fill-green-400" />
          LIVE
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: active call */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <h2 className="text-xs uppercase tracking-widest text-zinc-500">Incoming Call</h2>
          {activeCall ? (
            <CallCard call={activeCall} transcript={transcript} onDecision={handleDecision} deciding={deciding} />
          ) : (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 h-48 flex items-center justify-center text-zinc-600 text-sm">
              No active calls
            </div>
          )}
        </div>

        {/* Right: history + contacts */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex gap-1 border-b border-zinc-800">
            {(['calls', 'contacts'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm capitalize transition-colors ${
                  tab === t ? 'text-white border-b-2 border-indigo-500 -mb-px' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'calls' && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/10 overflow-hidden">
              <CallLog calls={calls} />
            </div>
          )}

          {tab === 'contacts' && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/10 overflow-hidden">
              <div className="p-4 border-b border-zinc-800 flex flex-wrap gap-2">
                <input
                  className="flex-1 min-w-[120px] rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                  placeholder="Name"
                  value={newContact.name}
                  onChange={e => setNewContact(p => ({ ...p, name: e.target.value }))}
                />
                <input
                  className="flex-1 min-w-[120px] rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                  placeholder="+1XXXXXXXXXX"
                  value={newContact.phone}
                  onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))}
                />
                <input
                  className="flex-1 min-w-[100px] rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                  placeholder="Notes"
                  value={newContact.notes}
                  onChange={e => setNewContact(p => ({ ...p, notes: e.target.value }))}
                />
                <button
                  onClick={addContact}
                  className="flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-sm font-medium transition-colors"
                >
                  <UserPlus className="w-4 h-4" /> Add
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-2 text-sm transition-colors"
                >
                  <Upload className="w-4 h-4" /> CSV
                </button>
                <input ref={fileRef} type="file" accept=".csv" className="hidden"
                  onChange={e => e.target.files?.[0] && importCSV(e.target.files[0])} />
              </div>
              <div className="divide-y divide-zinc-800/50">
                {contacts.length === 0 && (
                  <p className="text-center text-zinc-600 text-sm py-8">No contacts yet.</p>
                )}
                {contacts.map(c => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-zinc-900/40">
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-zinc-500">{c.phone}{c.notes ? ` · ${c.notes}` : ''}</p>
                    </div>
                    <button onClick={() => deleteContact(c.id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
