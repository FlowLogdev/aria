import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'
import { pushEvent } from '@/lib/pusher'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const VoiceResponse = twilio.twiml.VoiceResponse

export async function POST(req: NextRequest) {
  // Twilio sends application/x-www-form-urlencoded
  const bodyText = await req.text()
  const params = new URLSearchParams(bodyText)
  const from: string = params.get('From') ?? ''
  const callSid: string = params.get('CallSid') ?? ''

  // Normalize — strip whatsapp: prefix
  const normalized = from.replace('whatsapp:', '').trim()
  const channel: 'phone' | 'whatsapp' = from.startsWith('whatsapp:') ? 'whatsapp' : 'phone'

  console.log('📞 Incoming call from:', normalized, '| SID:', callSid)

  // Check contacts table
  const { data: contact, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('phone', normalized)
    .single()

  console.log('📒 Contact lookup:', contact?.name ?? 'not found', error?.code ?? '')

  // Insert call record
  const { data: callRecord } = await supabase
    .from('calls')
    .insert({
      call_sid: callSid,
      vapi_call_id: null,
      from_number: normalized,
      display_name: contact?.name ?? null,
      channel,
      line: null,
      status: contact ? 'picked_up' : 'ringing',
      caller_name: contact?.name ?? null,
      caller_company: null,
      caller_reason: null,
      duration_seconds: null,
      transcript: null,
      summary: null,
      recording_url: null,
      ended_at: null,
      owner_decision: null,
    })
    .select()
    .single()

  const twiml = new VoiceResponse()

  if (contact && callRecord) {
    // KNOWN contact — ring owner directly, bypass Aria
    console.log('✅ Known contact — forwarding to owner')
    await pushEvent({ type: 'INCOMING_KNOWN', call: callRecord })
    twiml.dial().number(process.env.OWNER_FORWARD_NUMBER!)
  } else {
    // UNKNOWN — send to Aria via Vapi stream
    console.log('❓ Unknown caller — routing to Aria')
    if (callRecord) {
      await pushEvent({ type: 'INCOMING_UNKNOWN', call: callRecord })
    }
    const connect = twiml.connect()
    connect.stream({
      url: `wss://api.vapi.ai/call/incoming?assistant_id=${process.env.VAPI_ASSISTANT_ID}`,
    })
  }

  return new NextResponse(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  })
}
