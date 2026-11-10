import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCallRecordingUrl } from '@/lib/vapi'

// Vapi's download links expire, so callers ask for a fresh one each time a call is played.
export async function recordingResponse(callId: string): Promise<NextResponse> {
  const { data: call } = await supabaseAdmin
    .from('calls')
    .select('vapi_call_id, recording_url')
    .eq('id', callId)
    .single()
  if (!call) return NextResponse.json({ error: 'Call not found' }, { status: 404 })

  let url: string | null = call.recording_url
  if (!url && call.vapi_call_id) {
    try {
      url = await getCallRecordingUrl(call.vapi_call_id)
    } catch (err) {
      console.error('[RECORDING] lookup failed', err)
      return NextResponse.json({ error: 'Could not load recording' }, { status: 502 })
    }
  }
  if (!url) return NextResponse.json({ error: 'No recording for this call' }, { status: 404 })
  return NextResponse.json({ url })
}
