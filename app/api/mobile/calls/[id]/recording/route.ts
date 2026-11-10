import { NextRequest, NextResponse } from 'next/server'
import { isAppAuthorized } from '@/lib/appAuth'
import { recordingResponse } from '@/lib/callRecording'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAppAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  return recordingResponse(id)
}
