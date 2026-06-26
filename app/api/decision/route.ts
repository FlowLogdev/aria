import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, updateCall } from '@/lib/supabase'
import { transferCall, sendVoicemailMessage } from '@/lib/vapi'

export async function POST(req: NextRequest) {
  const { callId, decision } = await req.json()

  if (!callId || !['pickup', 'voicemail'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { data: call } = await supabaseAdmin
    .from('calls')
    .select('*')
    .eq('id', callId)
    .single()

  if (!call) {
    return NextResponse.json({ error: 'Call not found' }, { status: 404 })
  }

  if (decision === 'pickup') {
    const forwardNumber = process.env.OWNER_FORWARD_NUMBER ?? ''
    if (call.vapi_call_id) {
      await transferCall(call.vapi_call_id, forwardNumber)
    }
    await updateCall(callId, { status: 'picked_up', owner_decision: 'pickup' })
    return NextResponse.json({ success: true })
  }

  if (decision === 'voicemail') {
    if (call.vapi_call_id) {
      await sendVoicemailMessage(call.vapi_call_id)
    }
    await updateCall(callId, { status: 'voicemail', owner_decision: 'voicemail' })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown decision' }, { status: 400 })
}
