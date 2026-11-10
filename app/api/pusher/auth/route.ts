import { NextRequest, NextResponse } from 'next/server'
import { ARIA_CHANNEL, pusherServer } from '@/lib/pusher'

// Reached only with a valid dashboard session, enforced by proxy.ts.
export async function POST(req: NextRequest) {
  const form = await req.formData()
  const socketId = form.get('socket_id')
  const channel = form.get('channel_name')

  if (typeof socketId !== 'string' || channel !== ARIA_CHANNEL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json(pusherServer.authorizeChannel(socketId, channel))
}
