import { NextRequest, NextResponse } from 'next/server'
import { validateTwilioSignature, buildVapiTwiML, buildForwardTwiML } from '@/lib/twilio'
import { findContactByPhone, insertCall } from '@/lib/supabase'
import { pushEvent } from '@/lib/pusher'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const params = Object.fromEntries(new URLSearchParams(body))

  // Validate Twilio signature in production
  if (process.env.NODE_ENV === 'production') {
    const signature = req.headers.get('x-twilio-signature') ?? ''
    const url = `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/twilio`
    if (!validateTwilioSignature(signature, url, params)) {
      return new NextResponse('Forbidden', { status: 403 })
    }
  }

  const callSid: string = params.CallSid ?? ''
  let fromRaw: string = params.From ?? ''
  const to: string = params.To ?? ''

  // Detect channel
  let channel: 'phone' | 'whatsapp' = 'phone'
  if (fromRaw.startsWith('whatsapp:')) {
    channel = 'whatsapp'
    fromRaw = fromRaw.replace('whatsapp:', '')
  }

  // Look up contact
  const contact = await findContactByPhone(fromRaw)

  // Insert call record
  const callRecord = await insertCall({
    call_sid: callSid,
    vapi_call_id: null,
    from_number: fromRaw,
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

  if (contact && callRecord) {
    // Known contact — push event and forward directly
    await pushEvent({ type: 'INCOMING_KNOWN', call: callRecord })
    const forwardNumber = process.env.OWNER_FORWARD_NUMBER ?? ''
    return new NextResponse(buildForwardTwiML(forwardNumber), {
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  if (callRecord) {
    // Unknown caller — send to Aria via Vapi
    await pushEvent({ type: 'INCOMING_UNKNOWN', call: callRecord })
  }

  return new NextResponse(buildVapiTwiML(), {
    headers: { 'Content-Type': 'text/xml' },
  })
}
