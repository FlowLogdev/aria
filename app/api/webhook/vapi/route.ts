import { NextRequest, NextResponse } from 'next/server'
import { getCallByVapiId, getCallBySid, updateCall, insertCall } from '@/lib/supabase'
import { pushEvent } from '@/lib/pusher'
import { sendSMSAlert } from '@/lib/twilio'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-vapi-secret')
  if (secret !== process.env.VAPI_SERVER_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  console.log('[VAPI]', JSON.stringify(body, null, 2))

  // Vapi wraps events in a "message" field
  const event = body.message ?? body
  const type: string = event.type ?? ''
  console.log('[VAPI] event type:', type)
  const call = event.call ?? body.call ?? {}

  const vapiCallId: string = call?.id ?? ''
  const callSid: string = call?.phoneCallProviderId ?? ''

  // Find or create our DB call record
  let dbCall = vapiCallId ? await getCallByVapiId(vapiCallId) : null
  if (!dbCall && callSid) dbCall = await getCallBySid(callSid)

  // Auto-create call record if missing (Vapi-owned numbers skip Twilio webhook)
  if (!dbCall && vapiCallId) {
    dbCall = await insertCall({
      call_sid: callSid || null,
      vapi_call_id: vapiCallId,
      from_number: call?.customer?.number ?? 'unknown',
      display_name: null,
      channel: 'phone',
      line: null,
      status: 'ringing',
      caller_name: null,
      caller_company: null,
      caller_reason: null,
      duration_seconds: null,
      transcript: null,
      summary: null,
      recording_url: null,
      ended_at: null,
      owner_decision: null,
    })
    if (dbCall) {
      await pushEvent({ type: 'INCOMING_UNKNOWN', call: dbCall })
    }
  }

  switch (type) {
    // Vapi sends this when a call comes in to a phone number with a Server URL
    // Must respond with the assistantId or the call is dropped
    case 'assistant-request': {
      return NextResponse.json({
        assistantId: process.env.VAPI_ASSISTANT_ID,
      })
    }

    case 'call-started': {
      if (dbCall) {
        const updated = await updateCall(dbCall.id, {
          status: 'screening',
          vapi_call_id: vapiCallId || dbCall.vapi_call_id,
        })
        if (updated) {
          await pushEvent({ type: 'CALL_SCREENING', callId: updated.id, vapiCallId })
        }
      }
      break
    }

    case 'speech-update':
    case 'transcript': {
      const text: string = event.transcript ?? event.speechUpdate?.content ?? ''
      if (dbCall && text) {
        await pushEvent({ type: 'TRANSCRIPT_UPDATE', callId: dbCall.id, text })
      }
      break
    }

    // Vapi sends tool-calls (plural) for custom tools
    case 'tool-calls': {
      const toolCallList = event.toolCallList ?? []
      for (const toolCall of toolCallList) {
        const fnName: string = toolCall.function?.name ?? ''
        let fnArgs: Record<string, string> = {}
        try {
          fnArgs = typeof toolCall.function?.arguments === 'string'
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function?.arguments ?? {}
        } catch { /* ignore parse errors */ }

        if (fnName === 'checkAvailability') {
          const {
            callerName = '',
            callerCompany = '',
            callerPhone = '',
            callerReason = '',
            line = 'business',
            Line = '',
          } = fnArgs

          const resolvedLine = line || Line || 'business'

          if (dbCall) {
            const updated = await updateCall(dbCall.id, {
              status: 'holding',
              caller_name: callerName,
              caller_company: callerCompany,
              caller_reason: callerReason,
              line: resolvedLine,
            })
            if (updated) {
              await pushEvent({
                type: 'CALLER_INFO_READY',
                callId: updated.id,
                callerName,
                callerCompany,
                callerPhone,
                callerReason,
                line: resolvedLine,
              })
            }
          }

          // SMS alert to owner
          sendSMSAlert({ callerName, callerCompany, callerPhone, callerReason, line: resolvedLine }).catch(() => {})

          // Respond to Vapi with the tool result — tells Aria to hold
          return NextResponse.json({
            results: [{
              toolCallId: toolCall.id,
              result: 'The owner has been notified and is checking availability. Please ask the caller to hold the line and play a brief hold message every 15 seconds.',
            }],
          })
        }
      }
      break
    }

    // Legacy function-call support
    case 'function-call': {
      const fnName: string = event.functionCall?.name ?? ''
      const fnArgs = event.functionCall?.parameters ?? event.functionCall?.arguments ?? {}
      if (fnName === 'checkAvailability') {
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

    case 'end-of-call-report':
    case 'call-ended': {
      const durationSeconds = Math.round(
        call?.endedAt && call?.startedAt
          ? (new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000
          : 0
      )
      const transcript: string = event.artifact?.transcript ?? event.transcript ?? ''
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
