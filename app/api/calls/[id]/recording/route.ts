import { NextRequest } from 'next/server'
import { recordingResponse } from '@/lib/callRecording'

// Reached only with a valid dashboard session, enforced by proxy.ts.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return recordingResponse(id)
}
