import { NextRequest, NextResponse } from 'next/server'
import { getCallByVapiId, getCallBySid, updateCall } from '@/lib/supabase'
import { pushEvent } from '@/lib/pusher'

export async function POST(req: NextRequest) {
  // Validate Vapi server secret
  const secret = req.headers.get('x-vapi-secret')
  if (secret !== process.env.VAPI_SERVER_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const event = await req.json()
  const { type, call } = event

  // Resolve our DB call record from the Vapi call id or Twilio SID
  const vapiCallId: string = call?.id ?? event?.call_id ?? ''
  const callSid: string = call?.phoneCallProviderId ?? ''

  let dbCall = vapiCallId ? await getCallByVapiId(vapiCallId) : null
  if (!dbCall && callSid) dbCall = await getCallBySid(callSid)

  // If this is the first Vapi event, link the vapi_call_id to the DB call
  if (!dbCall && callSid) {
    // The call record was created by Twilio webhook; find it by SID and patch
    dbCall = await getCallBySid(callSid)
    if (dbCall && vapiCallId) {
      dbCall = await updateCall(dbCall.id, { vapi_call_id: vapiCallId })
    }
  }

  switch (type) {
    case 'call-started': {
      if (dbCall) {
        const updated = await updateCall(dbCall.id, {
          status: 'screening',
          vapi_call_id: vapiCallId || dbCall.vapi_call_id,
        })
        if (updated) {
          await pushEvent({ type: 'CALL_SCREENING', callId: updated.id, vapiCallId: vapiCallId })
        }
      }
      break
    }

    case 'transcript': {
      const text: string = event.transcript ?? ''
      if (dbCall && text) {
        await pushEvent({ type: 'TRANSCRIPT_UPDATE', callId: dbCall.id, text })
      }
      break
    }

    case 'function-call': {
      const fnName: string = event.functionCall?.name ?? ''
      const fnArgs = event.functionCall?.parameters ?? {}
      if (fnName === 'collectionComplete' || fnName === 'callerInfoReady') {
        const { callerName = '', callerCompany = '', callerPhone = '', callerReason = '', line = 'business' } = fnArgs
        if (dbCall) {
          await updateCall(dbCall.id, {
            status: 'holding',
            caller_name: callerName,
            caller_company: callerCompany,
            caller_reason: callerReason,
            line,
          })
          await pushEvent({
            type: 'CALLER_INFO_READY',
            callId: dbCall.id,
            callerName,
            callerCompany,
            callerPhone,
            callerReason,
            line,
          })
        }
        return NextResponse.json({ result: 'holding' })
      }
      break
    }

    case 'call-ended': {
      const durationSeconds: number = Math.round((call?.endedAt
        ? (new Date(call.endedAt).getTime() - new Date(call.startedAt ?? Date.now()).getTime()) / 1000
        : 0))
      const transcript: string = event.artifact?.transcript ?? ''
      if (dbCall) {
        const updated = await updateCall(dbCall.id, {
          status: 'ended',
          duration_seconds: durationSeconds,
          transcript: transcript || null,
          ended_at: new Date().toISOString(),
        })
        if (updated) {
          await pushEvent({ type: 'CALL_ENDED', callId: updated.id, duration: durationSeconds })
        }
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
