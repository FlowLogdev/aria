import twilio from 'twilio'
import { NextRequest } from 'next/server'
import { twilioClient, validateTwilioSignature } from '@/lib/twilio'
import { supabaseAdmin, type Call } from '@/lib/supabase'

const VoiceResponse = twilio.twiml.VoiceResponse
const VOICE = 'Polly.Joanna-Neural' as const

// Public base URL Twilio should call back on — taken from the incoming Vapi request so it
// always matches the production domain Vapi is configured with.
export function publicOrigin(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  return host ? `https://${host}` : (process.env.NEXT_PUBLIC_BASE_URL ?? '')
}

export async function readTwilioParams(req: NextRequest): Promise<{ params: Record<string, string>; valid: boolean }> {
  const params = Object.fromEntries(new URLSearchParams(await req.text()))
  const signature = req.headers.get('x-twilio-signature') ?? ''
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const url = `https://${host}${req.nextUrl.pathname}${req.nextUrl.search}`
  return { params, valid: validateTwilioSignature(signature, url, params) }
}

export function twimlResponse(twiml: { toString(): string }) {
  return new Response(twiml.toString(), { headers: { 'Content-Type': 'text/xml' } })
}

// Step 1: ring the owner. The announcement + "press 1 / press 2" is served by /api/webhook/owner-call.
export async function callOwner(callId: string, origin: string) {
  return twilioClient.calls.create({
    to: process.env.OWNER_FORWARD_NUMBER!,
    from: process.env.TWILIO_PHONE_NUMBER!,
    url: `${origin}/api/webhook/owner-call?callId=${callId}`,
    statusCallback: `${origin}/api/webhook/owner-call?callId=${callId}&step=status`,
    statusCallbackEvent: ['completed'],
    timeout: 25,
  })
}

export function announcementTwiml(call: Call, origin: string) {
  const name = call.caller_name || 'someone who did not give a name'
  const company = call.caller_company ? `, from ${call.caller_company}` : ''
  const reason = call.caller_reason ? `. They are calling about: ${call.caller_reason}` : ''

  const twiml = new VoiceResponse()
  const gather = twiml.gather({
    numDigits: 1,
    timeout: 8,
    action: `${origin}/api/webhook/owner-call?callId=${call.id}&step=decide`,
  })
  gather.say({ voice: VOICE }, `Hi, this is Aria. You have a call from ${name}${company}${reason}.`)
  gather.say({ voice: VOICE }, 'Press 1 to take the call. Press 2 to send them to voicemail.')
  // One repeat, then treat silence as "send to voicemail"
  const again = twiml.gather({
    numDigits: 1,
    timeout: 8,
    action: `${origin}/api/webhook/owner-call?callId=${call.id}&step=decide`,
  })
  again.say({ voice: VOICE }, 'Press 1 to take the call, or 2 for voicemail.')
  twiml.redirect(`${origin}/api/webhook/owner-call?callId=${call.id}&step=decide&Digits=2`)
  return twiml
}

// Atomically record the owner's decision so a digit press and the status callback can't both act.
export async function claimDecision(callId: string, decision: 'pickup' | 'voicemail'): Promise<Call | null> {
  const { data } = await supabaseAdmin
    .from('calls')
    .update({ owner_decision: decision, status: decision === 'pickup' ? 'picked_up' : 'voicemail' })
    .eq('id', callId)
    .is('owner_decision', null)
    .select()
    .single()
  return data as Call | null
}

function conferenceTwiml(callId: string) {
  const twiml = new VoiceResponse()
  twiml.dial().conference(
    { startConferenceOnEnter: true, endConferenceOnExit: true, beep: 'false' },
    `aria-${callId}`,
  )
  return twiml
}

// Press 1: pull the caller's leg off the Vapi stream into a conference; the owner joins it too.
export async function bridgeCallerToOwner(call: Call) {
  if (!call.call_sid) throw new Error('No Twilio CallSid for caller')
  await twilioClient.calls(call.call_sid).update({ twiml: conferenceTwiml(call.id).toString() })
  return conferenceTwiml(call.id)
}

// Press 2 (or no answer): have Aria take a message. Falls back to a Twilio-recorded voicemail
// if Vapi live control isn't available for this call.
export async function sendCallerToVoicemail(call: Call, origin: string) {
  const controlUrl = await getVapiControlUrl(call.vapi_call_id)
  if (controlUrl) {
    try {
      const res = await fetch(controlUrl, {
        signal: AbortSignal.timeout(5000),
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'add-message',
          message: {
            role: 'system',
            content:
              'Fabio is not available to take this call right now. Politely tell the caller he is unavailable, ' +
              'then take a voicemail: ask them for the message they would like to leave and confirm the best number to reach them. ' +
              'Do not call checkAvailability again. Let them know Fabio will get back to them, thank them, and say goodbye.',
          },
          triggerResponseEnabled: true,
        }),
      })
      if (res.ok) return
      console.error('[OWNER-CALL] Vapi control add-message failed', res.status)
    } catch (err) {
      console.error('[OWNER-CALL] Vapi control unavailable; using recorded voicemail', err)
    }
  }

  if (!call.call_sid) return
  const twiml = new VoiceResponse()
  twiml.say({ voice: VOICE }, "Sorry, Fabio isn't available right now. Please leave a message after the tone and he will get back to you.")
  twiml.record({
    maxLength: 120,
    playBeep: true,
    action: `${origin}/api/webhook/owner-call?callId=${call.id}&step=voicemail-done`,
    recordingStatusCallback: `${origin}/api/webhook/owner-call?callId=${call.id}&step=recording`,
  })
  await twilioClient.calls(call.call_sid).update({ twiml: twiml.toString() })
}

async function getVapiControlUrl(vapiCallId: string | null): Promise<string | null> {
  if (!vapiCallId || !process.env.VAPI_API_KEY) return null
  try {
    const res = await fetch(`https://api.vapi.ai/call/${vapiCallId}`, {
      signal: AbortSignal.timeout(5000),
      headers: { Authorization: `Bearer ${process.env.VAPI_API_KEY}` },
    })
    if (!res.ok) return null
    const vapiCall = await res.json()
    return vapiCall?.monitor?.controlUrl ?? null
  } catch {
    return null
  }
}

export function sayAndHangup(text: string) {
  const twiml = new VoiceResponse()
  if (text) twiml.say({ voice: VOICE }, text)
  twiml.hangup()
  return twiml
}
