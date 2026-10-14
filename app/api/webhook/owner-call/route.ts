import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, updateCall, type Call } from '@/lib/supabase'
import {
  readTwilioParams,
  twimlResponse,
  announcementTwiml,
  claimDecision,
  bridgeCallerToOwner,
  sendCallerToVoicemail,
  sayAndHangup,
} from '@/lib/ownerCall'

// Twilio webhooks for the outbound "who's calling — press 1 / press 2" call to the owner.
//   (no step)          owner answered → announce caller + gather digit
//   step=decide        owner pressed a digit (or timed out → Digits=2)
//   step=status        owner leg finished; if no decision was made, send caller to voicemail
//   step=recording     fallback Twilio voicemail recording is ready
//   step=voicemail-done caller finished recording the fallback voicemail
export async function POST(req: NextRequest) {
  const { params, valid } = await readTwilioParams(req)
  if (!valid) {
    console.error('[OWNER-CALL] invalid Twilio signature')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const callId = req.nextUrl.searchParams.get('callId') ?? ''
  const step = req.nextUrl.searchParams.get('step') ?? 'answer'
  const origin = `https://${req.headers.get('x-forwarded-host') ?? req.headers.get('host')}`

  const { data } = await supabaseAdmin.from('calls').select('*').eq('id', callId).single()
  const call = data as Call | null
  console.log('[OWNER-CALL]', step, callId, params.CallStatus ?? '', params.Digits ?? '')

  if (!call) return twimlResponse(sayAndHangup('Sorry, I could not find that call.'))

  switch (step) {
    case 'answer': {
      if (call.status === 'ended') return twimlResponse(sayAndHangup('Sorry, the caller already hung up.'))
      return twimlResponse(announcementTwiml(call, origin))
    }

    case 'decide': {
      const digit = params.Digits ?? req.nextUrl.searchParams.get('Digits') ?? ''
      if (digit === '1') {
        const claimed = await claimDecision(call.id, 'pickup')
        if (!claimed) return twimlResponse(sayAndHangup('This call was already handled.'))
        try {
          return twimlResponse(await bridgeCallerToOwner(claimed))
        } catch (err) {
          console.error('[OWNER-CALL] bridge failed', err)
          return twimlResponse(sayAndHangup('Sorry, the caller is no longer on the line.'))
        }
      }
      const claimed = await claimDecision(call.id, 'voicemail')
      if (claimed) {
        await sendCallerToVoicemail(claimed, origin).catch(err => console.error('[OWNER-CALL] voicemail failed', err))
      }
      return twimlResponse(sayAndHangup('Okay, I will take a message. Goodbye.'))
    }

    case 'status': {
      // Fires when the owner leg ends for any reason (no-answer, busy, failed, completed)
      const claimed = await claimDecision(call.id, 'voicemail')
      if (claimed) {
        await sendCallerToVoicemail(claimed, origin).catch(err => console.error('[OWNER-CALL] voicemail failed', err))
      }
      return NextResponse.json({ received: true })
    }

    case 'recording': {
      if (params.RecordingUrl) await updateCall(call.id, { recording_url: `${params.RecordingUrl}.mp3` })
      return NextResponse.json({ received: true })
    }

    case 'voicemail-done':
      return twimlResponse(sayAndHangup('Thank you. Goodbye.'))
  }

  return NextResponse.json({ received: true })
}
