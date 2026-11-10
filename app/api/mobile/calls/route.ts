import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAppAuthorized } from '@/lib/appAuth'

const COLUMNS =
  'id, from_number, display_name, caller_name, caller_company, caller_reason, status, owner_decision, started_at, ended_at, transcript, summary'

export async function GET(req: NextRequest) {
  if (!isAppAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const filter = req.nextUrl.searchParams.get('filter')
  const requested = parseInt(req.nextUrl.searchParams.get('limit') ?? '100', 10)
  const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 200) : 100

  let query = supabaseAdmin.from('calls').select(COLUMNS)
  if (filter === 'voicemail') query = query.eq('owner_decision', 'voicemail')

  const { data, error } = await query.order('started_at', { ascending: false }).limit(limit)
  if (error) {
    console.error('[MOBILE] calls query failed', error.message)
    return NextResponse.json({ error: 'Could not load calls' }, { status: 500 })
  }
  return NextResponse.json({ calls: data })
}
