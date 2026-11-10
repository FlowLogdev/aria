import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAppAuthorized } from '@/lib/appAuth'
import { getCallRecordingUrl } from '@/lib/vapi'

// Vapi's download links expire, so the app asks for a fresh one each time it plays a call.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAppAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data: call } = await supabaseAdmin
    .from('calls')
    .select('vapi_call_id, recording_url')
    .eq('id', id)
    .single()
  if (!call) return NextResponse.json({ error: 'Call not found' }, { status: 404 })

  let url: string | null = call.recording_url
  if (!url && call.vapi_call_id) {
    try {
      url = await getCallRecordingUrl(call.vapi_call_id)
    } catch (err) {
      console.error('[MOBILE] recording lookup failed', err)
      return NextResponse.json({ error: 'Could not load recording' }, { status: 502 })
    }
  }
  if (!url) return NextResponse.json({ error: 'No recording for this call' }, { status: 404 })
  return NextResponse.json({ url })
}
